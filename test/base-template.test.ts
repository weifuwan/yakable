import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  createBaseProject,
  readBaseTemplateManifest,
} from '../src/templates/base-template.js';
import { readProjectMetadata } from '../src/projects/project-metadata.js';
import { startGeneratedProject } from '../src/runtime/runtime.js';

const REQUIRED_FILES = [
  'package.json',
  'index.html',
  'vite.config.ts',
  'components.json',
  'yakable.template.json',
  'src/main.tsx',
  'src/App.tsx',
  'src/pages/Home.tsx',
  'src/styles.css',
  'src/styles/theme.css',
  'src/lib/utils.ts',
  'src/components/ui/button.tsx',
  'src/components/ui/input.tsx',
  'src/components/ui/label.tsx',
  'src/components/ui/separator.tsx',
];

test('Yakable Base declares a clear fixed/project ownership contract', async () => {
  const manifest = await readBaseTemplateManifest();

  assert.equal(manifest.id, 'base');
  assert.equal(manifest.version, 1);
  assert.ok(manifest.ownership.yakable.includes('src/components/ui/**'));
  assert.ok(manifest.ownership.yakable.includes('src/styles.css'));
  assert.ok(manifest.ownership.project.includes('src/styles/theme.css'));
  assert.ok(manifest.ownership.project.includes('public/**'));
  assert.ok(manifest.ownership.project.includes('src/pages/**'));
  assert.ok(manifest.ownership.project.includes('src/components/product/**'));
});

test('creates a runnable Base project without model generation', async () => {
  const tempRoot = await mkdtemp(path.join(process.cwd(), '.yakable-base-test-'));
  let started: Awaited<ReturnType<typeof startGeneratedProject>> | null = null;

  try {
    const result = await createBaseProject('base-demo', { outputRoot: tempRoot });

    for (const relativePath of REQUIRED_FILES) {
      const info = await stat(path.join(result.directory, ...relativePath.split('/')));
      assert.ok(info.isFile(), relativePath);
    }

    const packageJson = JSON.parse(
      await readFile(path.join(result.directory, 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };
    assert.equal(packageJson.scripts?.dev, 'vite');
    assert.equal(packageJson.scripts?.build, 'tsc --noEmit && vite build');

    const metadata = await readProjectMetadata(result.directory);
    assert.equal(metadata.name, 'base-demo');
    assert.equal(metadata.template, 'website');
    assert.deepEqual(metadata.routes, [{ path: '/', title: 'Home' }]);

    started = await startGeneratedProject(
      { id: result.id, directory: result.directory },
      { port: 0 },
    );
    assert.ok(await started.server.transformRequest('/src/App.tsx'));
    assert.ok(await started.server.transformRequest('/src/pages/Home.tsx'));
    assert.ok(await started.server.transformRequest('/src/styles.css'));
    assert.ok(await started.server.transformRequest('/src/styles/theme.css'));
  } finally {
    if (started) {
      await started.server.close().catch(() => undefined);
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rejects unsafe Base project ids', async () => {
  await assert.rejects(
    () => createBaseProject('../escape'),
    /Base project id must be/,
  );
});
