import assert from 'node:assert/strict';
import test from 'node:test';

import { createFrontendAgentEvent } from '../src/editing/frontend-agent.js';
import {
  createYakableApiServer,
  type RuntimeSession,
  type WebApiServices,
} from '../src/server/web-api.js';

const editIntent = {
  delta: {
    version: 1 as const,
    summary: 'Polish the Hero',
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
    async generate(prompt, buildIntent, onAgentItem) {
      assert.equal(prompt, 'Build a SaaS landing page');
      assert.equal(buildIntent.route, 'CREATE');
      for (const state of ['ROUTE', 'UNDERSTAND', 'DESIGN', 'TEMPLATE', 'GENERATE', 'WRITE', 'CHECK'] as const) {
        onAgentItem?.(createFrontendAgentEvent(state, 'COMPLETED', state.toLowerCase()));
      }
      return {
        id: 'created-project',
        name: 'Created Project',
        summary: 'Generated landing page',
        model: 'test-model',
        template: 'website',
        routes: [{ path: '/', title: 'Home' }],
        session: null,
        conversation: null,
      };
    },
    async beginEditRun(projectId, prompt, onRunCreated, onAgentItem) {
      assert.equal(projectId, 'demo-project');
      assert.equal(prompt, 'Polish the Hero');
      onRunCreated?.('run-1');
      onAgentItem?.(createFrontendAgentEvent('SELECT_CONTEXT', 'COMPLETED', 'selected'));
      onAgentItem?.(createFrontendAgentEvent('READ', 'COMPLETED', 'read'));
      onAgentItem?.(createFrontendAgentEvent('EDIT', 'COMPLETED', 'edited'));
      onAgentItem?.(createFrontendAgentEvent('CHECK', 'COMPLETED', 'healthy'));
      onAgentItem?.(createFrontendAgentEvent('OBSERVE', 'ACTIVE', 'waiting'));
      return {
        runId: 'run-1',
        status: 'WAITING_FOR_CLIENT_TOOL',
        projectId,
        userRequest: prompt,
        summary: 'Polished Hero',
        model: 'test-model',
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
    async continueEditRun(runId, result, onAgentItem) {
      assert.equal(runId, 'run-1');
      assert.equal(result.toolCallId, 'observe-1');
      onAgentItem?.(createFrontendAgentEvent('OBSERVE', 'COMPLETED', 'observed'));
      onAgentItem?.(createFrontendAgentEvent('CRITIQUE', 'COMPLETED', 'passed'));
      onAgentItem?.(createFrontendAgentEvent('DONE', 'COMPLETED', 'done'));
      return {
        runId,
        status: 'COMPLETED',
        projectId: 'demo-project',
        userRequest: 'Polish the Hero',
        summary: 'Polished Hero',
        model: 'test-model',
        changedFiles: ['src/components/Hero.tsx'],
        editIntent,
        contextSelection,
        projectCheck: { ok: true, value: { status: 'PASS', checks: [], diagnostics: [] } },
        visualFeedback: { status: 'PASS' },
      };
    },
    async startRuntime() {
      alive = true;
      return runtime;
    },
  };
}

function records(text: string): Array<Record<string, unknown>> {
  return text.trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>);
}

function progressStates(items: Array<Record<string, unknown>>): string[] {
  return items
    .filter((record) => record.type === 'agent-item')
    .map((record) => record.item as { type?: string; state?: string; status?: string })
    .filter((item) => item.type === 'progress')
    .map((item) => `${item.state}:${item.status}`);
}

test('agent-edit returns the server run id and waits for the browser client tool', async () => {
  const api = createYakableApiServer({ services: services() });
  const baseUrl = await api.listen(0);
  try {
    const response = await fetch(`${baseUrl}/api/projects/demo-project/agent-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Polish the Hero' }),
    });
    const streamed = records(await response.text());
    assert.deepEqual(streamed[0], { type: 'run-started', runId: 'run-1' });
    assert.equal(streamed.at(-1)?.type, 'await-client-tool');
    const payload = streamed.at(-1)?.result as { runId: string; clientTool: { toolCallId: string } };
    assert.equal(payload.runId, 'run-1');
    assert.equal(payload.clientTool.toolCallId, 'observe-1');
  } finally {
    await api.close();
  }
});

test('client-tool-result continues the same run to completion', async () => {
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
        output: { version: 1 },
      }),
    });
    const streamed = records(await response.text());
    assert.deepEqual(progressStates(streamed), [
      'OBSERVE:COMPLETED',
      'CRITIQUE:COMPLETED',
      'DONE:COMPLETED',
    ]);
    assert.equal(streamed.at(-1)?.type, 'result');
    const payload = streamed.at(-1)?.result as { runId: string; status: string };
    assert.equal(payload.runId, 'run-1');
    assert.equal(payload.status, 'COMPLETED');
  } finally {
    await api.close();
  }
});
