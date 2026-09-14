import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  appendProjectEditHistory,
  initializeProjectSession,
  readProjectConversation,
  readProjectSession,
} from '../src/projects/project-session.js';
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
    assert.equal(conversation?.messages[2]?.visualSelections?.[0]?.sourceId, 'yak_heading');
    assert.deepEqual(conversation?.messages[3]?.changedFiles, ['src/App.tsx', 'src/styles.css']);
  });
});

test('supports legacy projects that do not have a session yet', async () => {
  await withProject('yakable-sqlite-legacy-empty-', async (projectDirectory) => {
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

test('migrates legacy .yakable/session.json into SQLite on first read', async () => {
  await withProject('yakable-sqlite-migration-', async (projectDirectory) => {
    await mkdir(path.join(projectDirectory, '.yakable'), { recursive: true });
    await writeFile(
      path.join(projectDirectory, '.yakable', 'session.json'),
      JSON.stringify({
        version: 1,
        productRequest: 'Build a migrated project',
        initialSummary: 'Initial legacy summary',
        createdAt: '2026-09-13T10:00:00.000Z',
        updatedAt: '2026-09-13T10:05:00.000Z',
        edits: [
          {
            id: 'legacy-edit',
            createdAt: '2026-09-13T10:05:00.000Z',
            userRequest: 'Tighten spacing',
            assistantSummary: 'Spacing tightened',
            changedFiles: ['src/App.tsx'],
          },
        ],
      }),
      'utf8',
    );

    const migrated = await readProjectSession(projectDirectory);
    assert.equal(migrated?.productRequest, 'Build a migrated project');
    assert.equal(migrated?.edits[0]?.id, 'legacy-edit');

    await rm(path.join(projectDirectory, '.yakable'), { recursive: true, force: true });
    closeYakableDatabases();

    const fromDatabase = await readProjectSession(projectDirectory);
    assert.equal(fromDatabase?.initialSummary, 'Initial legacy summary');
    assert.equal(fromDatabase?.edits[0]?.assistantSummary, 'Spacing tightened');
  });
});
