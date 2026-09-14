import assert from 'node:assert/strict';
import test from 'node:test';

import { createFrontendAgentEvent } from '../src/editing/frontend-agent.js';
import {
  createYakableApiServer,
  type RuntimeSession,
  type WebApiServices,
} from '../src/server/web-api.js';

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
      throw new Error('not used');
    },
    async edit(projectId, prompt, onAgentEvent) {
      assert.equal(projectId, 'demo-project');
      assert.equal(prompt, 'Polish the Hero');
      onAgentEvent?.(createFrontendAgentEvent('SELECT_CONTEXT', 'ACTIVE', 'selecting'));
      onAgentEvent?.(createFrontendAgentEvent('SELECT_CONTEXT', 'COMPLETED', 'selected'));
      onAgentEvent?.(createFrontendAgentEvent('READ', 'COMPLETED', 'read'));
      onAgentEvent?.(createFrontendAgentEvent('EDIT', 'COMPLETED', 'edited'));
      onAgentEvent?.(createFrontendAgentEvent('CHECK', 'COMPLETED', 'healthy'));
      return {
        projectId,
        summary: 'Polished Hero',
        model: 'test-model',
        changedFiles: ['src/components/Hero.tsx'],
        session: null,
        conversation: null,
      };
    },
    async startRuntime() {
      alive = true;
      return runtime;
    },
  };
}

test('agent-edit streams real backend states before the final edit result', async () => {
  const api = createYakableApiServer({ services: services() });
  const baseUrl = await api.listen(0);

  try {
    const response = await fetch(`${baseUrl}/api/projects/demo-project/agent-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Polish the Hero' }),
    });

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/x-ndjson/);

    const records = (await response.text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    assert.deepEqual(
      records.filter((record) => record.type === 'agent-event').map((record) => {
        const event = record.event as { state: string; status: string };
        return `${event.state}:${event.status}`;
      }),
      [
        'SELECT_CONTEXT:ACTIVE',
        'SELECT_CONTEXT:COMPLETED',
        'READ:COMPLETED',
        'EDIT:COMPLETED',
        'CHECK:COMPLETED',
      ],
    );

    const final = records.at(-1) as {
      type: string;
      result: { summary: string; previewUrl: string };
    };
    assert.equal(final.type, 'result');
    assert.equal(final.result.summary, 'Polished Hero');
    assert.match(final.result.previewUrl, /revision=/);
  } finally {
    await api.close();
  }
});

test('agent-edit turns backend failures into one terminal stream record', async () => {
  const failing = services();
  failing.edit = async (_projectId, _prompt, onAgentEvent) => {
    onAgentEvent?.(createFrontendAgentEvent('SELECT_CONTEXT', 'ACTIVE', 'selecting'));
    throw new Error('context selection exploded');
  };

  const api = createYakableApiServer({ services: failing });
  const baseUrl = await api.listen(0);

  try {
    const response = await fetch(`${baseUrl}/api/projects/demo-project/agent-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Polish the Hero' }),
    });
    const records = (await response.text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    assert.equal(records[0]?.type, 'agent-event');
    assert.equal(records.at(-1)?.type, 'error');
    assert.match(String(records.at(-1)?.error), /context selection exploded/);
  } finally {
    await api.close();
  }
});
