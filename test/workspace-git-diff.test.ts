import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  initializeWorkspaceGitBaseline,
  readWorkspaceBaselineCommit,
  resetWorkspaceGitBaseline,
} from '../src/workspace/git-baseline.js';
import { readWorkspaceDiff } from '../src/workspace/workspace-diff.js';

test('workspace Git baseline tracks cumulative source changes but ignores Yakable metadata', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yakable-git-baseline-'));

  try {
    await mkdir(path.join(root, 'src'), { recursive: true });
    await mkdir(path.join(root, '.yakable'), { recursive: true });
    await writeFile(path.join(root, 'src/App.tsx'), 'export default function App() { return <main>Before</main>; }\n');
    await writeFile(path.join(root, 'src/DeleteMe.tsx'), 'export const DeleteMe = true;\n');
    await writeFile(path.join(root, '.yakable/project.json'), '{"version":1}\n');

    const baseline = await initializeWorkspaceGitBaseline(root);
    assert.match(baseline.commit, /^[0-9a-f]{40}$/i);
    assert.equal(await readWorkspaceBaselineCommit(root), baseline.commit);

    await writeFile(path.join(root, 'src/App.tsx'), 'export default function App() { return <main>After</main>; }\n');
    await rm(path.join(root, 'src/DeleteMe.tsx'));
    await writeFile(path.join(root, 'src/New.tsx'), 'export const New = true;\n');
    await writeFile(path.join(root, '.yakable/project.json'), '{"version":2}\n');

    const diff = await readWorkspaceDiff(root);
    const fileMap = new Map(diff.files.map((file) => [file.path, file.type]));

    assert.equal(diff.baselineCommit, baseline.commit);
    assert.equal(fileMap.get('src/App.tsx'), 'MODIFIED');
    assert.equal(fileMap.get('src/DeleteMe.tsx'), 'DELETED');
    assert.equal(fileMap.get('src/New.tsx'), 'ADDED');
    assert.equal(fileMap.has('.yakable/project.json'), false);
    assert.match(diff.unifiedDiff, /src\/App\.tsx/);
    assert.match(diff.unifiedDiff, /src\/DeleteMe\.tsx/);
    assert.match(diff.unifiedDiff, /src\/New\.tsx/);
    assert.doesNotMatch(diff.unifiedDiff, /\.yakable\/project\.json/);
    assert.ok(diff.addedLines > 0);
    assert.ok(diff.removedLines > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('resetWorkspaceGitBaseline makes the current workspace the new zero-diff state', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yakable-git-reset-'));

  try {
    await mkdir(path.join(root, 'src'), { recursive: true });
    await writeFile(path.join(root, 'src/App.tsx'), 'before\n');
    const first = await initializeWorkspaceGitBaseline(root);

    await writeFile(path.join(root, 'src/App.tsx'), 'after\n');
    assert.equal((await readWorkspaceDiff(root)).files.length, 1);

    const reset = await resetWorkspaceGitBaseline(root);
    assert.notEqual(reset.commit, first.commit);

    const diff = await readWorkspaceDiff(root);
    assert.deepEqual(diff.files, []);
    assert.equal(diff.unifiedDiff, '');
    assert.equal(diff.addedLines, 0);
    assert.equal(diff.removedLines, 0);
    assert.equal(await readFile(path.join(root, 'src/App.tsx'), 'utf8'), 'after\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
