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

test('API startup resumes projects interrupted while starting runtime', async () => {
  let status: 'STARTING_RUNTIME' | 'READY' = 'STARTING_RUNTIME';
  let runtimeStarts = 0;
  let alive = false;

  const runtime: RuntimeSession = {
    url: 'http://127.0.0.1:59004/',
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
      throw new Error('Not used in runtime recovery test.');
    },
    async reconcileInterruptedCreates() {
      return {
        failedProjectIds: [],
        runtimePendingProjectIds: ['recover-runtime-project'],
      };
    },
    async readCreateStatus(projectId) {
      assert.equal(projectId, 'recover-runtime-project');
      return {
        project: {
          id: projectId,
          name: 'Recover Runtime Project',
          prompt: 'Build a homepage',
          status,
          createdAt: '2026-09-15T05:40:00.000Z',
          updatedAt:
            status === 'READY'
              ? '2026-09-15T05:40:03.000Z'
              : '2026-09-15T05:40:02.000Z',
        },
        run: null,
      };
    },
    async generate() {
      throw new Error('Not used in runtime recovery test.');
    },
    async beginEditRun() {
      throw new Error('Not used in runtime recovery test.');
    },
    async continueEditRun() {
      throw new Error('Not used in runtime recovery test.');
    },
    async startRuntime(projectId) {
      assert.equal(projectId, 'recover-runtime-project');
      runtimeStarts += 1;
      alive = true;
      status = 'READY';
      return runtime;
    },
  };

  const api = createYakableApiServer({ services });
  const baseUrl = await api.listen(0);
  try {
    assert.equal(runtimeStarts, 1);
    assert.equal(status, 'READY');

    const creationResponse = await fetch(
      `${baseUrl}/api/projects/recover-runtime-project/creation`,
    );
    assert.equal(creationResponse.status, 200);
    const creation = await creationResponse.json() as { project: { status: string } };
    assert.equal(creation.project.status, 'READY');

    const streamResponse = await fetch(
      `${baseUrl}/api/projects/recover-runtime-project/creation/stream`,
    );
    assert.equal(streamResponse.status, 200);
    const streamText = await streamResponse.text();
    assert.match(streamText, /"type":"snapshot"/);
    assert.match(streamText, /"type":"ready"/);
    assert.ok(streamText.includes('"previewUrl":"http://127.0.0.1:59004/'));
    assert.equal(runtimeStarts, 1, 'recovered runtime should be reused by the stream');
  } finally {
    await api.close();
  }
});
