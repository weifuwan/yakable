import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { resolveGeneratedProject, startGeneratedProject } from '../src/runtime.js';

async function createFixture(root: string, id = 'demo-project'): Promise<string> {
  const directory = path.join(root, id);
  await mkdir(path.join(directory, 'src'), { recursive: true });
  await writeFile(path.join(directory, 'package.json'), '{"name":"demo-project"}', 'utf8');
  await writeFile(
    path.join(directory, 'index.html'),
    '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
    'utf8',
  );
  await writeFile(
    path.join(directory, 'src/main.tsx'),
    'document.querySelector("#root")!.textContent = "Stage 2 works";',
    'utf8',
  );
  await writeFile(
    path.join(directory, 'src/App.tsx'),
    'export default function App() { return null; }',
    'utf8',
  );
  return directory;
}

test('resolves a project id only inside the generated root', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'yakable-stage2-'));
  const generatedRoot = path.join(tempRoot, 'generated');

  try {
    await mkdir(generatedRoot);
    const expected = await createFixture(generatedRoot);
    const resolved = await resolveGeneratedProject('demo-project', generatedRoot);
    assert.equal(resolved.directory, expected);
    assert.equal(resolved.id, 'demo-project');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rejects a project outside the generated root', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'yakable-stage2-outside-'));
  const generatedRoot = path.join(tempRoot, 'generated');
  const outsideRoot = path.join(tempRoot, 'outside');

  try {
    await mkdir(generatedRoot);
    const outside = await createFixture(outsideRoot);
    await assert.rejects(
      () => resolveGeneratedProject(outside, generatedRoot),
      /only access projects inside the generated\/ directory/,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('starts a real local Vite runtime for a generated project', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'yakable-stage2-runtime-'));
  const generatedRoot = path.join(tempRoot, 'generated');

  try {
    await mkdir(generatedRoot);
    await createFixture(generatedRoot);
    const project = await resolveGeneratedProject('demo-project', generatedRoot);
    const runtime = await startGeneratedProject(project, { port: 0 });

    try {
      const response = await fetch(runtime.url);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /src\/main\.tsx/);
      assert.match(html, /data-yakable-preview-bridge/);
      assert.match(html, /yakable:selection-ready/);
    } finally {
      await runtime.server.close();
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
