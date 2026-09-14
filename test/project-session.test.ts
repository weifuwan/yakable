import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  appendProjectEditHistory,
  initializeProjectSession,
  readProjectSession,
} from '../src/projects/project-session.js';
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

test('persists generation context and successful manual edits', async () => {
  const projectDirectory = await mkdtemp(path.join(os.tmpdir(), 'yakable-session-'));

  try {
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
      createdAt: '2026-09-14T02:05:00.000Z',
    });

    assert.equal(updated.edits.length, 1);
    assert.equal(updated.edits[0]?.userRequest, 'Remove all card shadows');
    assert.deepEqual(updated.edits[0]?.changedFiles, ['src/App.tsx', 'src/styles.css']);

    const reopened = await readProjectSession(projectDirectory);
    assert.equal(reopened?.productRequest, 'Build a clean developer tool landing page');
    assert.equal(reopened?.edits[0]?.assistantSummary, 'Removed card shadows');
    assert.equal(reopened?.updatedAt, '2026-09-14T02:05:00.000Z');
  } finally {
    await rm(projectDirectory, { recursive: true, force: true });
  }
});

test('supports legacy projects that do not have a session yet', async () => {
  const projectDirectory = await mkdtemp(path.join(os.tmpdir(), 'yakable-session-legacy-'));

  try {
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
  } finally {
    await rm(projectDirectory, { recursive: true, force: true });
  }
});
