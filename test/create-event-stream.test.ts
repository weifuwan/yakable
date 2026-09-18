import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createYakableApiServer,
  type RuntimeSession,
  type WebApiServices,
} from '../src/server/web-api.js';
import type { AgentProtocolItem } from '../src/protocol/agent-protocol.js';
import type { BuildIntentDecision } from '../src/types.js';

const decision: BuildIntentDecision = {
  version: 1,
  route: 'CREATE',
  confidence: 'high',
  message: 'Build it.',
};

const projectId = 'stream-project-2026-09-15-test';
const runId = 'stream-create-run';
const createdAt = '2026-09-15T04:55:00.000Z';

function progress(
  state: 'GENERATE' | 'WRITE',
  status: 'ACTIVE' | 'COMPLETED',
  message: string,
): AgentProtocolItem {
  return {
    version: 1,
    id: `progress:${state}:0`,
    type: 'progress',
    state,
    status,
    startedAt: createdAt,
    ...(status === 'COMPLETED' ? { completedAt: '2026-09-15T04:55:01.000Z' } : {}),
    message,
  };
}

function streamFixture() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let status: 'CREATING' | 'GENERATING' | 'READY' = 'CREATING';
  let runStatus: 'RUNNING' | 'COMPLETED' = 'RUNNING';
  let alive = false;
  const items: AgentProtocolItem[] = [];

  const runtime: RuntimeSession = {
    url: 'http://127.0.0.1:59005/',
    metadata: {
      version: 1,
      template: 'website',
      routes: [{ path: '/', title: 'Home' }],
      name: 'Stream Project',
    },
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
      assert.equal(prompt, 'Build a live project');
      return decision;
    },
    async bootstrapCreate(prompt) {
      return {
        reservation: { projectId, agentRunId: runId, createdAt },
        project: {
          id: projectId,
          name: 'Stream Project',
          prompt,
          status: 'CREATING',
          createdAt,
          updatedAt: createdAt,
        },
        run: { id: runId, status: 'RUNNING', startedAt: createdAt },
      };
    },
    async readCreateStatus(requestedProjectId) {
      if (requestedProjectId !== projectId) return null;
      return {
        project: {
          id: projectId,
          name: 'Stream Project',
          prompt: 'Build a live project',
          status,
          activeRunId: runId,
          createdAt,
          updatedAt: status === 'READY' ? '2026-09-15T04:55:03.000Z' : createdAt,
        },
        run: {
          id: runId,
          status: runStatus,
          startedAt: createdAt,
          ...(runStatus === 'COMPLETED'
            ? { completedAt: '2026-09-15T04:55:03.000Z' }
            : {}),
          items: [...items],
        },
      };
    },
    async generate(_prompt, _decision, onAgentItem) {
      status = 'GENERATING';
      const generating = progress('GENERATE', 'ACTIVE', 'Generating the interface');
      items.push(generating);
      onAgentItem?.(generating);
      await gate;
      const generated = progress('GENERATE', 'COMPLETED', 'Generated the interface');
      items.splice(0, 1, generated);
      onAgentItem?.(generated);
      const written = progress('WRITE', 'COMPLETED', 'Wrote project files');
      items.push(written);
      onAgentItem?.(written);
      return {
        id: projectId,
        name: 'Stream Project',
        summary: 'Built live',
        model: 'test-model',
        template: 'website',
        routes: [{ path: '/', title: 'Home' }],
        session: null,
        conversation: null,
      };
    },
    async beginEditRun() {
      throw new Error('Not used.');
    },
    async continueEditRun() {
      throw new Error('Not used.');
    },
    async startRuntime(requestedProjectId) {
      assert.equal(requestedProjectId, projectId);
      alive = true;
      status = 'READY';
      runStatus = 'COMPLETED';
      return runtime;
    },
  };

  return { services, release };
}

function records(text: string): Array<Record<string, unknown>> {
  return text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

test('creation stream delivers persisted snapshots, live items, and ready runtime', async () => {
  const fixture = streamFixture();
  const api = createYakableApiServer({ services: fixture.services });
  const baseUrl = await api.listen(0);

  try {
    const bootstrap = await fetch(`${baseUrl}/api/projects/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Build a live project' }),
    });
    assert.equal(bootstrap.status, 202);

    const streamPromise = fetch(
      `${baseUrl}/api/projects/${projectId}/creation/stream`,
      { headers: { Accept: 'application/x-ndjson' } },
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    fixture.release();

    const stream = await streamPromise;
    assert.equal(stream.status, 200);
    const streamed = records(await stream.text());

    assert.equal(streamed[0]?.type, 'snapshot');
    assert.ok(streamed.some((record) => record.type === 'agent-item'));
    const ready = streamed.find((record) => record.type === 'ready') as
      | { runtime?: { projectId?: string; previewUrl?: string } }
      | undefined;
    assert.equal(ready?.runtime?.projectId, projectId);
    assert.match(ready?.runtime?.previewUrl ?? '', /revision=/);
  } finally {
    fixture.release();
    await api.close();
  }
});
