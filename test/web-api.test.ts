import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createYakableApiServer,
  type RuntimeSession,
  type WebApiServices,
} from '../src/server/web-api.js';
import type {
  BuildIntentDecision,
  ProjectConversation,
  ProjectSessionState,
} from '../src/types.js';

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

const conversation: ProjectConversation = {
  projectId: 'generated-project',
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
  messages: [
    {
      id: 'initial-user',
      role: 'user',
      content: 'Build a dashboard',
      createdAt: session.createdAt,
    },
    {
      id: 'initial-assistant',
      role: 'assistant',
      content: 'Generated dashboard',
      createdAt: session.createdAt,
    },
  ],
};

const createDecision: BuildIntentDecision = {
  version: 1,
  route: 'CREATE',
  confidence: 'high',
  message: 'Ready to build.',
};

const editIntent = {
  delta: {
    version: 1 as const,
    summary: 'Make the hero blue',
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
  relevantFiles: ['src/App.tsx'],
  searchQuery: null,
  reason: 'test',
  source: 'model' as const,
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
    async gateBuildIntent(prompt) {
      assert.ok(prompt.length > 0);
      return createDecision;
    },
    async generate(prompt, buildIntent) {
      assert.equal(prompt, 'Build a dashboard');
      assert.equal(buildIntent.route, 'CREATE');
      return {
        id: 'generated-project',
        name: 'Generated Project',
        summary: 'Generated dashboard',
        model: 'test-model',
        template: metadata.template,
        routes: metadata.routes,
        session,
        conversation,
      };
    },
    async message() {
      return {
        decision: {
          version: 1,
          route: 'CHAT' as const,
          confidence: 'high' as const,
          message: 'Got it. What would you like to do next?',
        },
        conversation,
      };
    },
    async beginEditRun(projectId, prompt, onRunCreated) {
      assert.equal(projectId, 'generated-project');
      assert.equal(prompt, 'Make the hero blue');
      onRunCreated?.('edit-run-1');
      return {
        runId: 'edit-run-1',
        status: 'WAITING_FOR_CLIENT_TOOL',
        projectId,
        userRequest: prompt,
        summary: 'Updated hero',
        model: 'test-model',
        changedFiles: ['src/App.tsx'],
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
      assert.equal(runId, 'edit-run-1');
      assert.equal(result.toolCallId, 'observe-1');
      return {
        runId,
        status: 'COMPLETED',
        projectId: 'generated-project',
        userRequest: 'Make the hero blue',
        summary: 'Updated hero',
        model: 'test-model',
        changedFiles: ['src/App.tsx'],
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
    async readSession() {
      return session;
    },
    async readConversation() {
      return conversation;
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

function ndjson(text: string): Array<Record<string, unknown>> {
  return text.trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>);
}

test('web API lists projects and wires project creation to runtime', async () => {
  const api = createYakableApiServer({ services: fakeServices() });
  const baseUrl = await api.listen(0);
  try {
    const listResponse = await fetch(`${baseUrl}/api/projects`);
    const list = await listResponse.json() as { projects: Array<{ id: string; name: string }> };
    assert.deepEqual(list.projects.map((project) => project.id), ['demo-project']);

    const createResponse = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Build a dashboard' }),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json() as {
      decision: BuildIntentDecision;
      project: { id: string; template: string; routes: Array<{ path: string }> };
      previewUrl: string;
    };
    assert.equal(created.decision.route, 'CREATE');
    assert.equal(created.project.id, 'generated-project');
    assert.deepEqual(created.project.routes.map((route) => route.path), ['/', '/account']);
    assert.match(created.previewUrl, /revision=/);
  } finally {
    await api.close();
  }
});

test('web API preserves conversational project messages', async () => {
  const api = createYakableApiServer({ services: fakeServices() });
  const baseUrl = await api.listen(0);
  try {
    const response = await fetch(`${baseUrl}/api/projects/generated-project/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'good' }),
    });
    assert.equal(response.status, 200);
    const result = await response.json() as { decision: { route: string } };
    assert.equal(result.decision.route, 'CHAT');
  } finally {
    await api.close();
  }
});

test('web API keeps one edit run across the client tool continuation', async () => {
  const api = createYakableApiServer({ services: fakeServices() });
  const baseUrl = await api.listen(0);
  try {
    const startResponse = await fetch(`${baseUrl}/api/projects/generated-project/agent-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Make the hero blue' }),
    });
    const started = ndjson(await startResponse.text());
    assert.deepEqual(started[0], { type: 'run-started', runId: 'edit-run-1' });
    assert.equal(started.at(-1)?.type, 'await-client-tool');

    const continuation = await fetch(`${baseUrl}/api/agent-runs/edit-run-1/client-tool-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolCallId: 'observe-1',
        toolName: 'observe_preview',
        status: 'FAILED',
        error: 'preview unavailable in test',
      }),
    });
    const completed = ndjson(await continuation.text());
    assert.equal(completed.at(-1)?.type, 'result');
    const payload = completed.at(-1)?.result as {
      runId: string;
      changedFiles: string[];
      routes: Array<{ path: string }>;
      previewUrl: string;
    };
    assert.equal(payload.runId, 'edit-run-1');
    assert.deepEqual(payload.changedFiles, ['src/App.tsx']);
    assert.deepEqual(payload.routes.map((route) => route.path), ['/', '/account']);
    assert.match(payload.previewUrl, /revision=/);
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
    const updated = await updateResponse.json() as { project: { name: string; starred: boolean } };
    assert.equal(updated.project.name, 'Renamed Project');
    assert.equal(updated.project.starred, true);

    const remixResponse = await fetch(`${baseUrl}/api/projects/demo-project/remix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const remixed = await remixResponse.json() as { project: { id: string } };
    assert.equal(remixed.project.id, 'demo-project-copy');

    const deleteResponse = await fetch(`${baseUrl}/api/projects/demo-project`, { method: 'DELETE' });
    assert.equal((await deleteResponse.json() as { ok: boolean }).ok, true);
  } finally {
    await api.close();
  }
});
