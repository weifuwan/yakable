import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { applyProjectPatch, parseProjectPatch, readProjectSnapshot } from '../src/edit.js';
import type { ResolvedGeneratedProject } from '../src/runtime.js';

async function createFixture(root: string): Promise<ResolvedGeneratedProject> {
  const directory = path.join(root, 'demo-project');
  await mkdir(path.join(directory, 'src/components'), { recursive: true });
  await mkdir(path.join(directory, 'dist'), { recursive: true });
  await writeFile(path.join(directory, 'package.json'), '{"name":"demo-project"}', 'utf8');
  await writeFile(path.join(directory, 'index.html'), '<div id="root"></div>', 'utf8');
  await writeFile(path.join(directory, 'src/main.tsx'), 'import App from "./App";', 'utf8');
  await writeFile(
    path.join(directory, 'src/App.tsx'),
    'export default function App() { return <main>Before</main>; }',
    'utf8',
  );
  await writeFile(path.join(directory, 'src/styles.css'), 'body { margin: 0; }', 'utf8');
  await writeFile(path.join(directory, '.env'), 'SECRET=do-not-send', 'utf8');
  await writeFile(path.join(directory, 'dist/bundle.js'), 'compiled output', 'utf8');
  return { directory, id: 'demo-project' };
}

test('parses a focused project change set', () => {
  const patch = parseProjectPatch(
    JSON.stringify({
      summary: 'Update the Hero copy',
      changes: [
        {
          path: 'src/App.tsx',
          content: 'export default function App() { return <main>After</main>; }',
        },
      ],
    }),
  );

  assert.equal(patch.summary, 'Update the Hero copy');
  assert.deepEqual(patch.changes.map((change) => change.path), ['src/App.tsx']);
});

test('rejects root configuration and traversal changes', () => {
  assert.throws(
    () =>
      parseProjectPatch(
        JSON.stringify({ summary: 'bad', changes: [{ path: 'package.json', content: '{}' }] }),
      ),
    /can only modify src\/\*\*, public\/\*\*, or index.html/,
  );

  assert.throws(
    () =>
      parseProjectPatch(
        JSON.stringify({ summary: 'bad', changes: [{ path: '../escape.ts', content: 'x' }] }),
      ),
    /not safe/,
  );
});

test('reads source context without secrets or build output', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'yakable-edit-context-'));

  try {
    const project = await createFixture(tempRoot);
    const snapshot = await readProjectSnapshot(project);
    const paths = snapshot.files.map((file) => file.path);

    assert.ok(paths.includes('package.json'));
    assert.ok(paths.includes('src/App.tsx'));
    assert.ok(!paths.includes('.env'));
    assert.ok(!paths.includes('dist/bundle.js'));
    assert.ok(!snapshot.files.some((file) => file.content.includes('do-not-send')));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('applies only returned files and preserves unrelated source', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'yakable-edit-apply-'));

  try {
    const project = await createFixture(tempRoot);
    const beforeStyles = await readFile(path.join(project.directory, 'src/styles.css'), 'utf8');
    const patch = parseProjectPatch(
      JSON.stringify({
        summary: 'Change the main copy and add a badge',
        changes: [
          {
            path: 'src/App.tsx',
            content: 'export default function App() { return <main>After</main>; }',
          },
          {
            path: 'src/components/Badge.tsx',
            content: 'export function Badge() { return <span>New</span>; }',
          },
        ],
      }),
    );

    const changed = await applyProjectPatch(project, patch);
    const afterApp = await readFile(path.join(project.directory, 'src/App.tsx'), 'utf8');
    const afterStyles = await readFile(path.join(project.directory, 'src/styles.css'), 'utf8');

    assert.deepEqual(changed, ['src/App.tsx', 'src/components/Badge.tsx']);
    assert.match(afterApp, /After/);
    assert.equal(afterStyles, beforeStyles);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
