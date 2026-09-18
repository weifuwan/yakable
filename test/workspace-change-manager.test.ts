import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  WorkspaceChangeConflictError,
  WorkspaceChangeManager,
} from '../src/workspace/change-manager.js';
import { workspaceChangedPaths } from '../src/workspace/change-set.js';

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yakable-workspace-change-'));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'src/App.tsx'), 'before app', 'utf8');
  await writeFile(path.join(root, 'src/old.ts'), 'old file', 'utf8');
  return root;
}

test('applies one atomic workspace change set with before/after state', async () => {
  const root = await fixture();
  try {
    const manager = new WorkspaceChangeManager(root, {
      idFactory: () => 'change-set-1',
      now: () => new Date('2026-09-15T01:00:00.000Z'),
    });

    const changeSet = await manager.apply('Refine the app', [
      { path: 'src/App.tsx', content: 'after app' },
      { path: 'src/New.tsx', content: 'new file' },
      { path: 'src/old.ts', content: null },
    ]);

    assert.equal(changeSet.id, 'change-set-1');
    assert.equal(changeSet.createdAt, '2026-09-15T01:00:00.000Z');
    assert.deepEqual(workspaceChangedPaths(changeSet), [
      'src/App.tsx',
      'src/New.tsx',
      'src/old.ts',
    ]);
    assert.deepEqual(
      changeSet.files.map((file) => ({
        path: file.path,
        type: file.type,
        before: file.beforeContent,
        after: file.afterContent,
      })),
      [
        { path: 'src/App.tsx', type: 'MODIFIED', before: 'before app', after: 'after app' },
        { path: 'src/New.tsx', type: 'ADDED', before: null, after: 'new file' },
        { path: 'src/old.ts', type: 'DELETED', before: 'old file', after: null },
      ],
    );

    assert.equal(await readFile(path.join(root, 'src/App.tsx'), 'utf8'), 'after app');
    assert.equal(await readFile(path.join(root, 'src/New.tsx'), 'utf8'), 'new file');
    assert.equal(await stat(path.join(root, 'src/old.ts')).catch(() => null), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rolls back an applied change set to its exact previous state', async () => {
  const root = await fixture();
  try {
    const manager = new WorkspaceChangeManager(root);
    const changeSet = await manager.apply('Temporary edit', [
      { path: 'src/App.tsx', content: 'temporary' },
      { path: 'src/New.tsx', content: 'temporary new file' },
      { path: 'src/old.ts', content: null },
    ]);

    await manager.rollback(changeSet);

    assert.equal(await readFile(path.join(root, 'src/App.tsx'), 'utf8'), 'before app');
    assert.equal(await stat(path.join(root, 'src/New.tsx')).catch(() => null), null);
    assert.equal(await readFile(path.join(root, 'src/old.ts'), 'utf8'), 'old file');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('refuses rollback when the workspace has diverged after the change set', async () => {
  const root = await fixture();
  try {
    const manager = new WorkspaceChangeManager(root);
    const changeSet = await manager.apply('Edit app', [
      { path: 'src/App.tsx', content: 'agent edit' },
    ]);
    await writeFile(path.join(root, 'src/App.tsx'), 'human edit after agent', 'utf8');

    await assert.rejects(
      () => manager.rollback(changeSet),
      (error: unknown) =>
        error instanceof WorkspaceChangeConflictError && error.path === 'src/App.tsx',
    );
    assert.equal(await readFile(path.join(root, 'src/App.tsx'), 'utf8'), 'human edit after agent');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('blocks unsafe, infrastructure, and environment paths', async () => {
  const root = await fixture();
  try {
    const manager = new WorkspaceChangeManager(root);
    await assert.rejects(
      () => manager.apply('escape', [{ path: '../outside.ts', content: 'bad' }]),
      /not safe/,
    );
    await assert.rejects(
      () => manager.apply('git write', [{ path: '.git/config', content: 'bad' }]),
      /blocked root/,
    );
    await assert.rejects(
      () => manager.apply('secret write', [{ path: 'src/.env.local', content: 'bad' }]),
      /environment files/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects no-op change sets', async () => {
  const root = await fixture();
  try {
    const manager = new WorkspaceChangeManager(root);
    await assert.rejects(
      () => manager.apply('No-op', [{ path: 'src/App.tsx', content: 'before app' }]),
      /no effective file mutations/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
