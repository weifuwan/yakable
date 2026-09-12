import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createYakableApiServer,
  type RuntimeSession,
  type WebApiServices,
} from '../src/web-api.js';

const metadata = {
  version: 1 as const,
  template: 'app' as const,
  routes: [
    { path: '/', title: 'Home' },
    { path: '/account', title: 'Account' },
  ],
};

function fakeServices(): WebApiServices {
  let alive = false;
  const runtime: RuntimeSession = {
    url: 'http://127.0.0.1:59001/',
    metadata,
    isAlive: () => alive,
    async close() { alive = false; },
  };

  return {
    async listProjects() {
      return [{ id: 'demo-project', updatedAt: '2026-09-11T07:00:00.000Z' }];
    },
    async generate(prompt) {
      assert.equal(prompt, 'Build a dashboard');
      return {
        id: 'generated-project',
        summary: 'Generated dashboard',
        model: 'test-model',
        template: metadata.template,
        routes: metadata.routes,
      };
    },
    async edit(projectId, prompt) {
      assert.equal(projectId, 'generated-project');
      assert.equal(prompt, 'Make the hero blue');
      return {
        projectId,
        summary: 'Updated hero',
        model: 'test-model',
        changedFiles: ['src/App.tsx'],
      };
    },
    async startRuntime() {
      alive = true;
      return runtime;
    },
  };
}

test('web API lists projects and wires Prompt -> Template -> Routes -> Run', async () => {
  const api = createYakableApiServer({ services: fakeServices() });
  const baseUrl = await api.listen(0);

  try {
    const listResponse = await fetch(`${baseUrl}/api/projects`);
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json() as { projects: Array<{ id: string }> };
    assert.deepEqual(list.projects.map((project) => project.id), ['demo-project']);

    const createResponse = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Build a dashboard' }),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json() as {
      project: { id: string; template: string; routes: Array<{ path: string }> };
      previewUrl: string;
    };
    assert.equal(created.project.id, 'generated-project');
    assert.equal(created.project.template, 'app');
    assert.deepEqual(created.project.routes.map((route) => route.path), ['/', '/account']);
    assert.match(created.previewUrl, /revision=/);

    const runtimeResponse = await fetch(`${baseUrl}/api/projects/generated-project/runtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const runtimeResult = await runtimeResponse.json() as {
      template: string;
      routes: Array<{ path: string }>;
    };
    assert.equal(runtimeResult.template, 'app');
    assert.deepEqual(runtimeResult.routes.map((route) => route.path), ['/', '/account']);
  } finally {
    await api.close();
  }
});

test('web API wires follow-up Prompt -> Patch while keeping route metadata', async () => {
  const api = createYakableApiServer({ services: fakeServices() });
  const baseUrl = await api.listen(0);

  try {
    await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Build a dashboard' }),
    });

    const editResponse = await fetch(`${baseUrl}/api/projects/generated-project/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Make the hero blue' }),
    });
    assert.equal(editResponse.status, 200);
    const edited = await editResponse.json() as {
      changedFiles: string[];
      previewUrl: string;
      routes: Array<{ path: string }>;
    };
    assert.deepEqual(edited.changedFiles, ['src/App.tsx']);
    assert.deepEqual(edited.routes.map((route) => route.path), ['/', '/account']);
    assert.match(edited.previewUrl, /revision=/);
  } finally {
    await api.close();
  }
});
