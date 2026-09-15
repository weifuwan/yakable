import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createYakableApiServer,
  type RuntimeSession,
  type WebApiServices,
} from '../src/server/web-api.js';

const metadata = {
  version: 1 as const,
  template: 'website' as const,
  routes: [{ path: '/', title: 'Home' }],
};

function retryServices() {
  let generationCalled = false;
  let resolveCompleted!: () => void;
  const completed = new Promise<void>((resolve) => {
    resolveCompleted = resolve;
  });
  let alive = false;

  const runtime: RuntimeSession = {
    url: 'http://127.0.0.1:59003/',
    metadata,
    isAlive: () => alive,
    async close() {
      alive = false;
    },
  };

  const services: WebApiServices = {
    async listProjects() {
      return [];
    },
    async gateBuildIntent() {
      throw new Error('Retry should not re-run Build Intent Gate.');
    },
    async bootstrapCreate(prompt, decision) {
      assert.equal(prompt, 'Build a failed homepage');
      assert.equal(decision.route, 'CREATE');
      return {
        reservation: {
          projectId: 'retry-project',
          agentRunId: 'retry-run',
          createdAt: '2026-09-15T05:30:00.000Z',
        },
        project: {
          id: 'retry-project',
          name: 'Retry Project',
          prompt,
          status: 'CREATING',
          createdAt: '2026-09-15T05:30:00.000Z',
          updatedAt: '2026-09-15T05:30:00.000Z',
        },
        run: {
          id: 'retry-run',
          status: 'RUNNING',
          startedAt: '2026-09-15T05:30:00.000Z',
        },
      };
    },
    async readCreateStatus(projectId) {
      if (projectId === 'failed-project') {
        return {
          project: {
            id: projectId,
            name: 'Failed Project',
            prompt: 'Build a failed homepage',
            status: 'FAILED',
            activeRunId: 'failed-run',
            failureMessage: 'Model request timed out',
            createdAt: '2026-09-15T05:20:00.000Z',
            updatedAt: '2026-09-15T05:21:00.000Z',
          },
          run: {
            id: 'failed-run',
            status: 'FAILED',
            startedAt: '2026-09-15T05:20:00.000Z',
            completedAt: '2026-09-15T05:21:00.000Z',
            items: [],
          },
        };
      }
      if (projectId === 'retry-project') {
        return {
          project: {
            id: projectId,
            name: 'Retry Project',
            prompt: 'Build a failed homepage',
            status: 'CREATING',
            activeRunId: 'retry-run',
            createdAt: '2026-09-15T05:30:00.000Z',
            updatedAt: '2026-09-15T05:30:00.000Z',
          },
          run: {
            id: 'retry-run',
            status: 'RUNNING',
            startedAt: '2026-09-15T05:30:00.000Z',
            items: [],
          },
        };
      }
      return null;
    },
    async generate(prompt, decision, _onAgentItem, reservation) {
      generationCalled = true;
      assert.equal(prompt, 'Build a failed homepage');
      assert.equal(decision.route, 'CREATE');
      assert.equal(reservation?.projectId, 'retry-project');
      return {
        id: 'retry-project',
        name: 'Retry Project',
        summary: 'Retried successfully',
        model: 'test-model',
        template: metadata.template,
        routes: metadata.routes,
        session: null,
        conversation: null,
      };
    },
    async beginEditRun() {
      throw new Error('Not used in retry test.');
    },
    async continueEditRun() {
      throw new Error('Not used in retry test.');
    },
    async startRuntime(projectId) {
      assert.equal(projectId, 'retry-project');
      alive = true;
      resolveCompleted();
      return runtime;
    },
  };

  return { services, completed, generationCalled: () => generationCalled };
}

test('failed project creation can start a fresh async create run', async () => {
  const fixture = retryServices();
  const api = createYakableApiServer({ services: fixture.services });
  const baseUrl = await api.listen(0);

  try {
    const response = await fetch(`${baseUrl}/api/projects/failed-project/creation/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(response.status, 202);
    const result = await response.json() as {
      accepted: boolean;
      retryOf: string;
      decision: { route: string };
      project: { id: string; status: string };
      run: { id: string; status: string };
    };

    assert.equal(result.accepted, true);
    assert.equal(result.retryOf, 'failed-project');
    assert.equal(result.decision.route, 'CREATE');
    assert.equal(result.project.id, 'retry-project');
    assert.equal(result.project.status, 'CREATING');
    assert.equal(result.run.id, 'retry-run');
    assert.equal(result.run.status, 'RUNNING');

    await fixture.completed;
    assert.equal(fixture.generationCalled(), true);

    const conflict = await fetch(`${baseUrl}/api/projects/retry-project/creation/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(conflict.status, 409);
  } finally {
    await api.close();
  }
});
