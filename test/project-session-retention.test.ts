import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  appendProjectEditHistory,
  readProjectConversation,
  readProjectSession,
} from '../src/projects/project-session.js';
import { closeYakableDatabases } from '../src/storage/database.js';

async function withProject(
  run: (projectDirectory: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yakable-long-session-'));
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

test('persists more than forty project edits so Context can compact them later', async () => {
  await withProject(async (projectDirectory) => {
    for (let index = 1; index <= 60; index += 1) {
      await appendProjectEditHistory(projectDirectory, {
        userRequest: `Request ${index}`,
        assistantSummary: `Summary ${index}`,
        changedFiles: [],
        createdAt: `2026-09-15T${String(Math.floor((index - 1) / 60)).padStart(2, '0')}:${String((index - 1) % 60).padStart(2, '0')}:00.000Z`,
      });
    }

    const session = await readProjectSession(projectDirectory);
    assert.equal(session?.edits.length, 60);
    assert.equal(session?.edits[0]?.userRequest, 'Request 1');
    assert.equal(session?.edits.at(-1)?.userRequest, 'Request 60');

    const conversation = await readProjectConversation(projectDirectory);
    assert.equal(conversation?.messages.length, 120);
    assert.equal(conversation?.messages[0]?.content, 'Request 1');
    assert.equal(conversation?.messages.at(-1)?.content, 'Summary 60');
  });
});
