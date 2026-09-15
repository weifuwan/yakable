import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createYakableApiServer,
  type RuntimeSession,
  type WebApiServices,
} from '../src/server/web-api.js';
import type { BuildIntentDecision } from '../src/types.js';

const createDecision: BuildIntentDecision = {
  version: 1,
  route: 'CREATE',
  confidence: 'high',
  message: 'Ready to build.',
};

const metadata = {
  version: 1 as const,
  template: 'website' as const,
  routes: [{ path: '/', title: 'Home' }],
};

function asyncCreateServices() {
  let releaseGeneration!: () => void;
  let resolveCompleted!: () => void;
  const generationGate = new Promise<void>((resolve) => {
    releaseGeneration = resolve;
  });
  const completed = new Promise<void>((resolve) => {
    resolveCompleted = resolve;
  });

  let generationStarted = false;
  let generationFinished = false;
  let projectStatus: 'CREATING' | 'READY' = 'CREATING';
  let runStatus: 'RUNNING' | 'COMPLETED' = 'RUNNING';
  let alive = false;

  const projectId = 'async-project-2026-09-15-test';
  const runId = 'async-create-run';
  const createdAt = '2026-09-15T04:15:00.000Z';
  const runtime: RuntimeSession = {
    url: 'http://127.0.0.1:59002/',
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
    async gateBuildIntent(prompt) {
      assert.equal(prompt, 'Build a SaaS homepage');
      return createDecision;
    },
    async bootstrapCreate(prompt, decision) {
      assert.equal(prompt, 'Build a SaaS homepage');
      assert.equal(decision.route, 'CREATE');
      return {
        reservation: {
          projectId,
          agentRunId: runId,
          createdAt,
        },
        project: {
          id: projectId,
          name: 'Async Project',
          prompt,
          status: 'CREATING',
          createdAt,
          updatedAt: createdAt,
        },
        run: {
          id: runId,
          status: 'RUNNING',
          startedAt: createdAt,
        },
      };
    },
    async readCreateStatus(requestedProjectId) {
      if (requestedProjectId !== projectId) return null;
      return {
        project: {
          id: projectId,
          name: 'Async Project',
          prompt: 'Build a SaaS homepage',
          status: projectStatus,
          activeRunId: runId,
          createdAt,
          updatedAt: projectStatus === 'READY' ? '2026-09-15T04:15:03.000Z' : createdAt,
        },
        run: {
          id: runId,
          status: runStatus,
          startedAt: createdAt,
          ...(runStatus === 'COMPLETED'
            ? { completedAt: '2026-09-15T04:15:03.000Z' }
            : {}),
          items: [],
        },
      };
    },
    async generate(prompt, decision, _onAgentItem, reservation) {
      assert.equal(prompt, 'Build a SaaS homepage');
      assert.equal(decision.route, 'CREATE');
      assert.deepEqual(reservation, {
        projectId,
        agentRunId: runId,
        createdAt,
      });
      generationStarted = true;
      await generationGate;
      generationFinished = true;
      return {
        id: projectId,
        name: 'Async Project',
        summary: 'Generated asynchronously',
        model: 'test-model',
        template: metadata.template,
        routes: metadata.routes,
        session: null,
        conversation: null,
      };
    },
    async beginEditRun() {
      throw new Error('Not used in async create test.');
    },
    async continueEditRun() {
      throw new Error('Not used in async create test.');
    },
    async startRuntime(requestedProjectId) {
      assert.equal(requestedProjectId, projectId);
      alive = true;
      projectStatus = 'READY';
      runStatus = 'COMPLETED';
      resolveCompleted();
      return runtime;
    },
  };

  return {
    services,
    releaseGeneration,
    completed,
    generationStarted: () => generationStarted,
    generationFinished: () => generationFinished,
  };
}

test('project bootstrap returns a project shell and create lifecycle before generation finishes', async () => {
  const fixture = asyncCreateServices();
  const api = createYakableApiServer({ services: fixture.services });
  const baseUrl = await api.listen(0);

  try {
    const response = await fetch(`${baseUrl}/api/projects/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Build a SaaS homepage' }),
    });

    assert.equal(response.status, 202);
    const result = await response.json() as {
      decision: BuildIntentDecision;
      project: { id: string; name: string };
      creation: {
        project: { id: string; status: string; activeRunId?: string };
        run: { id: string; status: string; items: unknown[] };
      };
    };
    assert.equal(result.decision.route, 'CREATE');
    assert.equal(result.project.id, 'async-project-2026-09-15-test');
    assert.equal(result.project.name, 'Async Project');
    assert.equal(result.creation.project.id, result.project.id);
    assert.equal(result.creation.project.status, 'CREATING');
    assert.equal(result.creation.project.activeRunId, 'async-create-run');
    assert.equal(result.creation.run.id, 'async-create-run');
    assert.equal(result.creation.run.status, 'RUNNING');
    assert.deepEqual(result.creation.run.items, []);
    assert.equal(fixture.generationStarted(), true);
    assert.equal(fixture.generationFinished(), false);

    const creatingResponse = await fetch(
      `${baseUrl}/api/projects/async-project-2026-09-15-test/creation`,
    );
    assert.equal(creatingResponse.status, 200);
    const creating = await creatingResponse.json() as {
      project: { status: string };
      run: { status: string };
    };
    assert.equal(creating.project.status, 'CREATING');
    assert.equal(creating.run.status, 'RUNNING');

    fixture.releaseGeneration();
    await fixture.completed;

    const readyResponse = await fetch(
      `${baseUrl}/api/projects/async-project-2026-09-15-test/creation`,
    );
    const ready = await readyResponse.json() as {
      project: { status: string };
      run: { status: string };
    };
    assert.equal(ready.project.status, 'READY');
    assert.equal(ready.run.status, 'COMPLETED');
    assert.equal(fixture.generationFinished(), true);
  } finally {
    fixture.releaseGeneration();
    await api.close();
  }
});

for (const route of ['CHAT', 'CLARIFY'] as const) {
  test(`project bootstrap creates a conversation project for ${route} intent`, async () => {
    const fixture = asyncCreateServices();
    let bootstrapCalled = false;
    let conversationCreated = false;
    const services: WebApiServices = {
      ...fixture.services,
      async gateBuildIntent() {
        return {
          version: 1,
          route,
          confidence: 'high',
          message: route === 'CHAT'
            ? 'Tell me what you want to build.'
            : 'What would you like me to build?',
        };
      },
      async bootstrapCreate() {
        bootstrapCalled = true;
        throw new Error('CREATE lifecycle should not be reserved for conversation-only intent.');
      },
      async generate(prompt, decision, _onAgentItem, reservation) {
        assert.equal(prompt, route === 'CHAT' ? 'hello' : 'Todo App');
        assert.equal(decision.route, route);
        assert.equal(reservation, undefined);
        conversationCreated = true;
        return {
          id: `${route.toLowerCase()}-project`,
          name: route === 'CHAT' ? 'Hello' : 'Todo App',
          summary: decision.message,
          model: 'build-intent',
          template: metadata.template,
          routes: metadata.routes,
          session: null,
          conversation: null,
        };
      },
    };

    const api = createYakableApiServer({ services });
    const baseUrl = await api.listen(0);
    try {
      const prompt = route === 'CHAT' ? 'hello' : 'Todo App';
      const response = await fetch(`${baseUrl}/api/projects/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      assert.equal(response.status, 201);
      const result = await response.json() as {
        decision: { route: string };
        project: { id: string; name: string };
        creation: unknown;
      };
      assert.equal(result.decision.route, route);
      assert.equal(result.project.id, `${route.toLowerCase()}-project`);
      assert.equal(result.creation, null);
      assert.equal(bootstrapCalled, false);
      assert.equal(conversationCreated, true);
      assert.equal(fixture.generationStarted(), false);
    } finally {
      fixture.releaseGeneration();
      await api.close();
    }
  });
}
