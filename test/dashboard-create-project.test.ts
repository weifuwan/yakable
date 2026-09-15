import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bootstrapProject,
  readProjectCreationStatus,
} from '../dashboard/src/create-project.js';

const originalFetch = globalThis.fetch;

test('dashboard create client bootstraps immediately and reads creation status', async () => {
  const requests: Array<{ url: string; method: string }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    requests.push({ url, method });

    if (url === '/api/projects/bootstrap') {
      assert.equal(method, 'POST');
      assert.equal(init?.body, JSON.stringify({ prompt: 'Build a SaaS homepage' }));
      return new Response(
        JSON.stringify({
          accepted: true,
          decision: {
            version: 1,
            route: 'CREATE',
            confidence: 'high',
            message: 'Ready to build.',
          },
          project: {
            id: 'saas-homepage-1',
            name: 'Saas Homepage',
            prompt: 'Build a SaaS homepage',
            status: 'CREATING',
            createdAt: '2026-09-15T04:00:00.000Z',
            updatedAt: '2026-09-15T04:00:00.000Z',
          },
          run: {
            id: 'run-1',
            status: 'RUNNING',
            startedAt: '2026-09-15T04:00:00.000Z',
          },
        }),
        { status: 202, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url === '/api/projects/saas-homepage-1/creation') {
      return new Response(
        JSON.stringify({
          project: {
            id: 'saas-homepage-1',
            name: 'Saas Homepage',
            prompt: 'Build a SaaS homepage',
            status: 'GENERATING',
            activeRunId: 'run-1',
            createdAt: '2026-09-15T04:00:00.000Z',
            updatedAt: '2026-09-15T04:00:01.000Z',
          },
          run: {
            id: 'run-1',
            status: 'RUNNING',
            startedAt: '2026-09-15T04:00:00.000Z',
            items: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    throw new Error(`Unexpected test request: ${method} ${url}`);
  }) as typeof fetch;

  try {
    const bootstrap = await bootstrapProject('Build a SaaS homepage');
    assert.equal(bootstrap.accepted, true);
    if (!bootstrap.accepted) return;
    assert.equal(bootstrap.project.id, 'saas-homepage-1');
    assert.equal(bootstrap.run.id, 'run-1');

    const status = await readProjectCreationStatus(bootstrap.project.id);
    assert.equal(status?.project.status, 'GENERATING');
    assert.equal(status?.project.activeRunId, 'run-1');
    assert.equal(status?.run?.status, 'RUNNING');
    assert.deepEqual(requests, [
      { url: '/api/projects/bootstrap', method: 'POST' },
      { url: '/api/projects/saas-homepage-1/creation', method: 'GET' },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('dashboard create client treats missing lifecycle as an existing ready project', async () => {
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ error: 'Project creation state does not exist.' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } },
  )) as typeof fetch;

  try {
    assert.equal(await readProjectCreationStatus('existing-project'), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
