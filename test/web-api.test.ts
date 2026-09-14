import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createYakableApiServer,
  type RuntimeSession,
  type WebApiServices,
} from '../src/server/web-api.js';
import type { ProjectSessionState } from '../src/types.js';

const metadata = {
  version: 1 as const,
  template: 'app' as const,
  routes: [
    { path: '/', title: 'Home' },
    { path: '/account', title: 'Account' },
  ],
};

const session: ProjectSessionState = {
  version: 1,
  productRequest: 'Build a dashboard',
  initialSummary: 'Generated dashboard',
  createdAt: '2026-09-11T07:00:00.000Z',
  updatedAt: '2026-09-11T07:05:00.000Z',
  edits: [
    {
      id: 'edit-1',
      createdAt: '2026-09-11T07:05:00.000Z',
      userRequest: 'Make the hero blue',
      assistantSummary: 'Updated hero',
      changedFiles: ['src/App.tsx'],
    },
  ],
};

function fakeServices(): WebApiServices {
  let alive = false;
  let name = 'Demo Project';
  let starred = false;
  const runtime: RuntimeSession = {
    url: 'http://127.0.0.1:59001/',
    metadata,
    isAlive: () => alive,
    async close() { alive = false; },
  };

  function item(id = 'demo-project') {
    return {
      id,
      name,
      updatedAt: '2026-09-11T07:00:00.000Z',
      starred,
      template: 'app' as const,
    };
  }

  return {
    async listProjects() {
      return [item()];
    },
    async generate(prompt) {
      assert.equal(prompt, 'Build a dashboard');
      return {
        id: 'generated-project',
        name: 'Generated Project',
        summary: 'Generated dashboard',
        model: 'test-model',
        template: metadata.template,
        routes: metadata.routes,
        session,
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
        session,
      };
    },
    async startRuntime() {
      alive = true;
      return runtime;
    },
    async readSession() {
      return session;
    },
    async updateProject(_projectId, patch) {
      if (patch.name) name = patch.name;
      if (typeof patch.starred === 'boolean') starred = patch.starred;
      return item();
    },
    async remixProject() {
      return { ...item('demo-project-copy'), name: 'Demo Project Copy' };
    },
    async deleteProject() {
      alive = false;
    },
  };
}

test('web API lists projects and wires Prompt -> Template -> Routes -> Run', async () => {
  const api = createYakableApiServer({ services: fakeServices() });
  const baseUrl = await api.listen(0);

  try {
    const listResponse = await fetch(`${baseUrl}/api/projects`);
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json() as { projects: Array<{ id: string; name: string }> };
    assert.deepEqual(list.projects.map((project) => project.id), ['demo-project']);
    assert.equal(list.projects[0]?.name, 'Demo Project');

    const createResponse = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Build a dashboard' }),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json() as {
      project: {
        id: string;
        template: string;
        routes: Array<{ path: string }>;
        session: ProjectSessionState;
      };
      previewUrl: string;
    };
    assert.equal(created.project.id, 'generated-project');
    assert.equal(created.project.template, 'app');
    assert.deepEqual(created.project.routes.map((route) => route.path), ['/', '/account']);
    assert.equal(created.project.session.productRequest, 'Build a dashboard');
    assert.match(created.previewUrl, /revision=/);

    const runtimeResponse = await fetch(`${baseUrl}/api/projects/generated-project/runtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const runtimeResult = await runtimeResponse.json() as {
      template: string;
      routes: Array<{ path: string }>;
      session: ProjectSessionState;
    };
    assert.equal(runtimeResult.template, 'app');
    assert.deepEqual(runtimeResult.routes.map((route) => route.path), ['/', '/account']);
    assert.equal(runtimeResult.session.edits[0]?.userRequest, 'Make the hero blue');
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
      session: ProjectSessionState;
    };
    assert.deepEqual(edited.changedFiles, ['src/App.tsx']);
    assert.deepEqual(edited.routes.map((route) => route.path), ['/', '/account']);
    assert.equal(edited.session.edits[0]?.assistantSummary, 'Updated hero');
    assert.match(edited.previewUrl, /revision=/);
  } finally {
    await api.close();
  }
});

test('web API updates, remixes, and deletes projects', async () => {
  const api = createYakableApiServer({ services: fakeServices() });
  const baseUrl = await api.listen(0);

  try {
    const updateResponse = await fetch(`${baseUrl}/api/projects/demo-project`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed Project', starred: true }),
    });
    assert.equal(updateResponse.status, 200);
    const updated = await updateResponse.json() as { project: { name: string; starred: boolean } };
    assert.equal(updated.project.name, 'Renamed Project');
    assert.equal(updated.project.starred, true);

    const remixResponse = await fetch(`${baseUrl}/api/projects/demo-project/remix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(remixResponse.status, 201);
    const remixed = await remixResponse.json() as { project: { id: string; name: string } };
    assert.equal(remixed.project.id, 'demo-project-copy');
    assert.equal(remixed.project.name, 'Demo Project Copy');

    const deleteResponse = await fetch(`${baseUrl}/api/projects/demo-project`, { method: 'DELETE' });
    assert.equal(deleteResponse.status, 200);
    assert.equal((await deleteResponse.json() as { ok: boolean }).ok, true);
  } finally {
    await api.close();
  }
});
