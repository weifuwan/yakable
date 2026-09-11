import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createYakableApiServer,
  type RuntimeSession,
  type WebApiServices,
} from '../src/web-api.js';

function fakeServices(): WebApiServices {
  let alive = false;
  const runtime: RuntimeSession = {
    url: 'http://127.0.0.1:59001/',
    isAlive: () => alive,
    async close() { alive = false; },
  };

  return {
    async listProjects() {
      return [{ id: 'demo-project', updatedAt: '2026-09-11T07:00:00.000Z' }];
    },
    async generate(prompt) {
      assert.equal(prompt, 'Build a dashboard');
      return { id: 'generated-project', summary: 'Generated dashboard', model: 'test-model' };
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

test('web API lists projects and wires Prompt -> Code -> Run', async () => {
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
    const created = await createResponse.json() as { project: { id: string }; previewUrl: string };
    assert.equal(created.project.id, 'generated-project');
    assert.match(created.previewUrl, /revision=/);
  } finally {
    await api.close();
  }
});

test('web API wires follow-up Prompt -> Patch while keeping the runtime', async () => {
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
    const edited = await editResponse.json() as { changedFiles: string[]; previewUrl: string };
    assert.deepEqual(edited.changedFiles, ['src/App.tsx']);
    assert.match(edited.previewUrl, /revision=/);
  } finally {
    await api.close();
  }
});
