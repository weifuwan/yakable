import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bootstrapProject,
  readProjectCreationStatus,
  retryProjectCreation,
} from '../dashboard/src/create-project.js';

const originalFetch = globalThis.fetch;

test('dashboard bootstrap client returns the project shell and seeded create lifecycle', async () => {
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
          decision: {
            version: 1,
            route: 'CREATE',
            confidence: 'high',
            message: 'Ready to build.',
          },
          project: {
            id: 'saas-homepage-1',
            name: 'Saas Homepage',
          },
          creation: {
            project: {
              id: 'saas-homepage-1',
              name: 'Saas Homepage',
              prompt: 'Build a SaaS homepage',
              status: 'CREATING',
              activeRunId: 'run-1',
              createdAt: '2026-09-15T04:00:00.000Z',
              updatedAt: '2026-09-15T04:00:00.000Z',
            },
            run: {
              id: 'run-1',
              status: 'RUNNING',
              startedAt: '2026-09-15T04:00:00.000Z',
              items: [],
            },
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
    assert.equal(bootstrap.decision.route, 'CREATE');
    assert.equal(bootstrap.project.id, 'saas-homepage-1');
    assert.equal(bootstrap.creation?.project.activeRunId, 'run-1');
    assert.equal(bootstrap.creation?.run?.id, 'run-1');

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

test('dashboard bootstrap client returns a project for CHAT without a create lifecycle', async () => {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(input), '/api/projects/bootstrap');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.body, JSON.stringify({ prompt: 'who are you' }));
    return new Response(
      JSON.stringify({
        decision: {
          version: 1,
          route: 'CHAT',
          confidence: 'high',
          message: 'I am Yakable.',
        },
        project: {
          id: 'who-are-you-project',
          name: 'who are you',
        },
        creation: null,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const bootstrap = await bootstrapProject('who are you');
    assert.equal(bootstrap.decision.route, 'CHAT');
    assert.equal(bootstrap.project.id, 'who-are-you-project');
    assert.equal(bootstrap.creation, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('dashboard create client treats missing lifecycle as an existing project', async () => {
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

test('dashboard create client retries a failed creation with a fresh project id', async () => {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(input), '/api/projects/failed-project/creation/retry');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.body, '{}');
    return new Response(
      JSON.stringify({
        retryOf: 'failed-project',
        decision: {
          version: 1,
          route: 'CREATE',
          confidence: 'high',
          message: 'Retrying project creation.',
        },
        project: {
          id: 'retry-project',
          name: 'Retry Project',
          prompt: 'Build a SaaS homepage',
          status: 'CREATING',
          createdAt: '2026-09-15T05:30:00.000Z',
          updatedAt: '2026-09-15T05:30:00.000Z',
        },
        run: {
          id: 'retry-run',
          status: 'RUNNING',
          startedAt: '2026-09-15T05:30:00.000Z',
        },
      }),
      { status: 202, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const retry = await retryProjectCreation('failed-project');
    assert.equal(retry.retryOf, 'failed-project');
    assert.equal(retry.project.id, 'retry-project');
    assert.equal(retry.run.id, 'retry-run');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
