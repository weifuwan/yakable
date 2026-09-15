import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  appendProjectEditHistory,
  initializeProjectSession,
  readProjectConversation,
  readProjectSession,
} from '../src/projects/project-session.js';
import {
  appendAgentRunEvent,
  completeAgentRun,
  createAgentRun,
} from '../src/storage/agent-run.js';
import { closeYakableDatabases } from '../src/storage/database.js';
import type { DesignIntentIR } from '../src/types.js';

const designIntent: DesignIntentIR = {
  version: 1,
  product: {
    type: 'developer-tool',
    surface: 'website',
    primaryGoal: 'explain the product',
    targetAudience: 'developers',
  },
  designDirection: 'Restrained technical landing page',
  styleSignals: ['clean'],
  requirements: [],
  directives: [],
  antiPatterns: ['heavy shadows'],
  openQuestions: [],
};

async function withProject(
  prefix: string,
  run: (projectDirectory: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  const projectDirectory = path.join(root, 'demo-project');
  await mkdir(projectDirectory, { recursive: true });
  const previousPath = process.env.YAKABLE_DB_PATH;
  process.env.YAKABLE_DB_PATH = path.join(root, 'yakable.db');

  try {
    await run(projectDirectory);
  } finally {
    closeYakableDatabases();
    if (previousPath === undefined) delete process.env.YAKABLE_DB_PATH;
    else process.env.YAKABLE_DB_PATH = previousPath;
    await rm(root, { recursive: true, force: true });
  }
}

test('persists generation context and successful edits in SQLite', async () => {
  await withProject('yakable-sqlite-session-', async (projectDirectory) => {
    const created = await initializeProjectSession(projectDirectory, {
      productRequest: 'Build a clean developer tool landing page',
      designIntent,
      initialSummary: 'Generated the landing page',
      createdAt: '2026-09-14T02:00:00.000Z',
    });

    assert.equal(created.productRequest, 'Build a clean developer tool landing page');
    assert.equal(created.designIntent?.designDirection, 'Restrained technical landing page');
    assert.deepEqual(created.edits, []);

    const createRun = createAgentRun({
      projectId: 'demo-project',
      kind: 'CREATE',
      prompt: 'Build a clean developer tool landing page',
      startedAt: '2026-09-14T02:00:01.000Z',
    });
    appendAgentRunEvent(createRun.id, {
      version: 1,
      state: 'ROUTE',
      status: 'COMPLETED',
      message: 'Routed the request to CREATE',
      at: '2026-09-14T02:00:02.000Z',
    });
    completeAgentRun(createRun.id, {
      model: 'deepseek-v4-pro',
      summary: 'Generated the landing page',
      completedAt: '2026-09-14T02:00:03.000Z',
    });

    const editRun = createAgentRun({
      projectId: 'demo-project',
      kind: 'EDIT',
      prompt: 'Remove all card shadows',
      startedAt: '2026-09-14T02:04:59.000Z',
    });
    appendAgentRunEvent(editRun.id, {
      version: 1,
      state: 'SELECT_CONTEXT',
      status: 'COMPLETED',
      message: 'Selected focused frontend context',
      at: '2026-09-14T02:05:00.000Z',
    });
    completeAgentRun(editRun.id, {
      model: 'deepseek-v4-pro',
      summary: 'Removed card shadows',
      completedAt: '2026-09-14T02:05:02.000Z',
    });

    const updated = await appendProjectEditHistory(projectDirectory, {
      userRequest: 'Remove all card shadows',
      assistantSummary: 'Removed card shadows',
      changedFiles: ['src/App.tsx', 'src/styles.css'],
      model: 'deepseek-v4-pro',
      visualSelections: [
        {
          sourceId: 'yak_heading',
          file: 'src/App.tsx',
          line: 18,
          column: 7,
          tagName: 'h1',
          text: 'Developer tools',
          selector: 'main > h1',
        },
      ],
      createdAt: '2026-09-14T02:05:00.000Z',
    });

    assert.equal(updated.edits.length, 1);
    assert.equal(updated.edits[0]?.userRequest, 'Remove all card shadows');
    assert.equal(updated.edits[0]?.model, 'deepseek-v4-pro');
    assert.equal(updated.edits[0]?.visualSelections?.[0]?.tagName, 'h1');
    assert.deepEqual(updated.edits[0]?.changedFiles, ['src/App.tsx', 'src/styles.css']);

    closeYakableDatabases();
    const reopened = await readProjectSession(projectDirectory);
    assert.equal(reopened?.productRequest, 'Build a clean developer tool landing page');
    assert.equal(reopened?.edits[0]?.assistantSummary, 'Removed card shadows');
    assert.equal(reopened?.edits[0]?.visualSelections?.[0]?.line, 18);
    assert.equal(reopened?.updatedAt, '2026-09-14T02:05:00.000Z');

    const conversation = await readProjectConversation(projectDirectory);
    assert.deepEqual(
      conversation?.messages.map((message) => [message.role, message.content]),
      [
        ['user', 'Build a clean developer tool landing page'],
        ['assistant', 'Generated the landing page'],
        ['user', 'Remove all card shadows'],
        ['assistant', 'Removed card shadows'],
      ],
    );
    assert.equal(conversation?.messages[1]?.agentRun?.id, createRun.id);
    assert.equal(conversation?.messages[1]?.agentRun?.kind, 'CREATE');
    assert.equal(conversation?.messages[1]?.agentRun?.events[0]?.state, 'ROUTE');
    assert.equal(conversation?.messages[2]?.visualSelections?.[0]?.sourceId, 'yak_heading');
    assert.deepEqual(conversation?.messages[3]?.changedFiles, ['src/App.tsx', 'src/styles.css']);
    assert.equal(conversation?.messages[3]?.agentRun?.id, editRun.id);
    assert.equal(conversation?.messages[3]?.agentRun?.kind, 'EDIT');
    assert.equal(conversation?.messages[3]?.agentRun?.events[0]?.state, 'SELECT_CONTEXT');
  });
});

test('starts SQLite history on the first successful edit when a project has no session', async () => {
  await withProject('yakable-sqlite-empty-', async (projectDirectory) => {
    assert.equal(await readProjectSession(projectDirectory), null);

    const updated = await appendProjectEditHistory(projectDirectory, {
      userRequest: 'Make the hero tighter',
      assistantSummary: 'Reduced hero spacing',
      changedFiles: ['src/App.tsx'],
      createdAt: '2026-09-14T03:00:00.000Z',
    });

    assert.equal(updated.productRequest, undefined);
    assert.equal(updated.designIntent, undefined);
    assert.equal(updated.edits[0]?.userRequest, 'Make the hero tighter');
  });
});
