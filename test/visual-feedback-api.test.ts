import assert from 'node:assert/strict';
import test from 'node:test';

import type { PageObservation } from '../src/runtime/page-observation.js';
import {
  createYakableApiServer,
  type RuntimeSession,
  type WebApiServices,
} from '../src/server/web-api.js';

const pageObservation: PageObservation = {
  version: 1,
  route: '/',
  viewport: {
    width: 1440,
    height: 900,
    scrollX: 0,
    scrollY: 0,
    devicePixelRatio: 1,
  },
  documentSize: { width: 1440, height: 1400 },
  elements: [
    {
      tagName: 'h1',
      text: 'Build faster',
      selector: 'main > h1',
      rect: { left: 120, top: 100, width: 620, height: 72 },
      source: { file: 'src/components/Hero.tsx', line: 12, column: 5 },
    },
  ],
  runtimeErrors: [],
  truncated: { elements: false, runtimeErrors: false },
};

const editIntent = {
  delta: {
    version: 1 as const,
    summary: 'Refine the Hero hierarchy.',
    scope: 'section' as const,
    targetHints: ['Hero'],
    directives: [],
    preserve: [],
  },
  source: 'model' as const,
  reason: 'test',
};

const contextSelection = {
  version: 1 as const,
  relevantFiles: ['src/components/Hero.tsx'],
  searchQuery: null,
  reason: 'test',
  source: 'model' as const,
};

function services(): WebApiServices {
  let alive = false;
  const runtime: RuntimeSession = {
    url: 'http://127.0.0.1:59001/',
    metadata: {
      version: 1,
      template: 'website',
      routes: [{ path: '/', title: 'Home' }],
    },
    isAlive: () => alive,
    async close() {
      alive = false;
    },
  };

  return {
    async listProjects() {
      return [];
    },
    async gateBuildIntent() {
      return {
        version: 1,
        route: 'CREATE',
        confidence: 'high',
        message: 'Create project.',
      };
    },
    async generate() {
      return {
        id: 'demo-project',
        name: 'Demo Project',
        summary: 'Demo',
        model: 'test-model',
        template: 'website',
        routes: [{ path: '/', title: 'Home' }],
        session: null,
        conversation: null,
      };
    },
    async beginEditRun() {
      return {
        runId: 'run-1',
        status: 'WAITING_FOR_CLIENT_TOOL',
        projectId: 'demo-project',
        userRequest: 'Polish the Hero',
        model: 'test-model',
        summary: 'Edited',
        changedFiles: ['src/components/Hero.tsx'],
        editIntent,
        contextSelection,
        projectCheck: { ok: true, value: { status: 'PASS', checks: [], diagnostics: [] } },
        clientTool: {
          toolCallId: 'observe-1',
          toolName: 'observe_preview',
          iteration: 0,
          message: 'Observe Preview',
        },
      };
    },
    async continueEditRun(runId, result) {
      assert.equal(runId, 'run-1');
      assert.equal(result.toolCallId, 'observe-1');
      assert.equal(result.status, 'COMPLETED');
      if (result.status === 'COMPLETED') {
        assert.deepEqual(result.output, pageObservation);
      }
      return {
        runId,
        status: 'COMPLETED',
        projectId: 'demo-project',
        userRequest: 'Polish the Hero',
        model: 'test-model',
        summary: 'Edited',
        changedFiles: ['src/components/Hero.tsx'],
        editIntent,
        contextSelection,
        projectCheck: { ok: true, value: { status: 'PASS', checks: [], diagnostics: [] } },
        visualFeedback: {
          status: 'PASS',
          initialObservation: pageObservation,
        },
      };
    },
    async startRuntime() {
      alive = true;
      return runtime;
    },
  };
}

test('browser can only return observe_preview results to the server-owned run', async () => {
  const api = createYakableApiServer({ services: services() });
  const baseUrl = await api.listen(0);
  try {
    const response = await fetch(`${baseUrl}/api/agent-runs/run-1/client-tool-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolCallId: 'observe-1',
        toolName: 'observe_preview',
        status: 'COMPLETED',
        output: pageObservation,
      }),
    });
    assert.equal(response.status, 200);
    const rows = (await response.text()).trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(rows.at(-1)?.type, 'result');
    assert.equal(rows.at(-1)?.result.visualFeedback.status, 'PASS');

    const oldCritique = await fetch(`${baseUrl}/api/projects/demo-project/critique`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(oldCritique.status, 404);

    const oldRepair = await fetch(`${baseUrl}/api/projects/demo-project/visual-repair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(oldRepair.status, 404);
  } finally {
    await api.close();
  }
});
