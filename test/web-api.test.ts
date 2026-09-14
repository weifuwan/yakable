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
    {
      id: 'edit-user',
      role: 'user',
      content: 'Make the hero blue',
      createdAt: session.updatedAt,
    },
    {
      id: 'edit-assistant',
      role: 'assistant',
      content: 'Updated hero',
      createdAt: session.updatedAt,
      changedFiles: ['src/App.tsx'],
    },
  ],
};

const createDecision: BuildIntentDecision = {
  version: 1,
  route: 'CREATE',
  confidence: 'high',
  message: 'Ready to build.',
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
    async edit(projectId, prompt) {
      assert.equal(projectId, 'generated-project');
      assert.equal(prompt, 'Make the hero blue');
      return {
        projectId,
        summary: 'Updated hero',
        model: 'test-model',
        changedFiles: ['src/App.tsx'],
        session,
        conversation,
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

test('web API lists projects and wires Build Intent -> Prompt -> Template -> Routes -> Run', async () => {
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
      decision: BuildIntentDecision;
      project: {
        id: string;
        template: string;
        routes: Array<{ path: string }>;
        session: ProjectSessionState;
        conversation: ProjectConversation;
      };
      previewUrl: string;
    };
    assert.equal(created.decision.route, 'CREATE');
    assert.equal(created.project.id, 'generated-project');
    assert.equal(created.project.template, 'app');
    assert.deepEqual(created.project.routes.map((route) => route.path), ['/', '/account']);
    assert.equal(created.project.session.productRequest, 'Build a dashboard');
    assert.equal(created.project.conversation.messages[0]?.role, 'user');
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
      conversation: ProjectConversation;
    };
    assert.equal(runtimeResult.template, 'app');
    assert.deepEqual(runtimeResult.routes.map((route) => route.path), ['/', '/account']);
    assert.equal(runtimeResult.session.edits[0]?.userRequest, 'Make the hero blue');
    assert.equal(runtimeResult.conversation.messages[2]?.content, 'Make the hero blue');
  } finally {
    await api.close();
  }
});

test('web API preserves CHAT/CLARIFY input as a project conversation', async () => {
  const services = fakeServices();
  let generated = false;
  let runtimeStarted = false;
  const chatDecision: BuildIntentDecision = {
    version: 1,
    route: 'CHAT',
    confidence: 'high',
    message: 'Hi! Tell me what you want to build.',
  };
  const chatSession: ProjectSessionState = {
    version: 1,
    productRequest: 'Hello',
    initialSummary: chatDecision.message,
    createdAt: '2026-09-11T08:00:00.000Z',
    updatedAt: '2026-09-11T08:00:00.000Z',
    edits: [],
  };
  const chatConversation: ProjectConversation = {
    projectId: 'chat-project',
    createdAt: chatSession.createdAt,
    updatedAt: chatSession.updatedAt,
    messages: [
      {
        id: 'chat-user',
        role: 'user',
        content: 'Hello',
        createdAt: chatSession.createdAt,
      },
      {
        id: 'chat-assistant',
        role: 'assistant',
        content: chatDecision.message,
        createdAt: chatSession.createdAt,
      },
    ],
  };

  services.gateBuildIntent = async () => chatDecision;
  services.generate = async (prompt, decision) => {
    generated = true;
    assert.equal(prompt, 'Hello');
    assert.equal(decision.route, 'CHAT');
    return {
      id: 'chat-project',
      name: 'Hello',
      summary: decision.message,
      model: 'build-intent',
      template: metadata.template,
      routes: metadata.routes,
      session: chatSession,
      conversation: chatConversation,
    };
  };
  const startRuntime = services.startRuntime;
  services.startRuntime = async (projectId) => {
    runtimeStarted = true;
    return startRuntime(projectId);
  };

  const api = createYakableApiServer({ services });
  const baseUrl = await api.listen(0);

  try {
    const response = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Hello' }),
    });
    assert.equal(response.status, 201);
    const result = await response.json() as {
      decision: BuildIntentDecision;
      project: { id: string; conversation: ProjectConversation };
      previewUrl: string;
    };
    assert.equal(result.decision.route, 'CHAT');
    assert.equal(result.project.id, 'chat-project');
    assert.equal(result.project.conversation.messages[0]?.content, 'Hello');
    assert.equal(result.project.conversation.messages[1]?.content, chatDecision.message);
    assert.match(result.previewUrl, /revision=/);
    assert.equal(generated, true);
    assert.equal(runtimeStarted, true);
  } finally {
    await api.close();
  }
});

test('web API routes conversational follow-ups without invoking Frontend Agent edit', async () => {
  const services = fakeServices();
  let editCalled = false;
  const followUpConversation: ProjectConversation = {
    ...conversation,
    updatedAt: '2026-09-11T07:06:00.000Z',
    messages: [
      ...conversation.messages,
      {
        id: 'chat-user-good',
        role: 'user',
        content: 'good',
        createdAt: '2026-09-11T07:06:00.000Z',
      },
      {
        id: 'chat-assistant-good',
        role: 'assistant',
        content: 'Got it. What would you like to do next?',
        createdAt: '2026-09-11T07:06:00.000Z',
      },
    ],
  };

  services.message = async (projectId, prompt) => {
    assert.equal(projectId, 'generated-project');
    assert.equal(prompt, 'good');
    return {
      decision: {
        version: 1,
        route: 'CHAT',
        confidence: 'high',
        message: 'Got it. What would you like to do next?',
      },
      conversation: followUpConversation,
    };
  };
  services.edit = async () => {
    editCalled = true;
    throw new Error('Frontend Agent edit should not run for CHAT.');
  };

  const api = createYakableApiServer({ services });
  const baseUrl = await api.listen(0);

  try {
    const response = await fetch(`${baseUrl}/api/projects/generated-project/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'good' }),
    });
    assert.equal(response.status, 200);
    const result = await response.json() as {
      decision: { route: string; message: string };
      conversation: ProjectConversation;
    };
    assert.equal(result.decision.route, 'CHAT');
    assert.equal(result.conversation.messages.at(-2)?.content, 'good');
    assert.equal(result.conversation.messages.at(-1)?.content, result.decision.message);
    assert.equal(editCalled, false);
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
      conversation: ProjectConversation;
    };
    assert.deepEqual(edited.changedFiles, ['src/App.tsx']);
    assert.deepEqual(edited.routes.map((route) => route.path), ['/', '/account']);
    assert.equal(edited.session.edits[0]?.assistantSummary, 'Updated hero');
    assert.equal(edited.conversation.messages.at(-1)?.content, 'Updated hero');
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
