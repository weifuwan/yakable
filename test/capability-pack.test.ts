import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createBaseProject } from '../src/templates/base-template.js';
import {
  installCapabilityPacks,
  listCapabilityPacks,
  readProjectCapabilityState,
} from '../src/templates/capability-pack.js';

async function withTempRoot(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yakable-capability-pack-'));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('lists the initial Stage 2.2 capability catalog with Yakable-owned UI files only', async () => {
  const packs = await listCapabilityPacks();
  assert.deepEqual(
    packs.map((pack) => pack.id),
    ['data-display', 'feedback', 'form', 'navigation', 'overlay'],
  );

  for (const pack of packs) {
    assert.ok(pack.files.length > 0);
    assert.ok(pack.files.every((file) => file.startsWith('src/components/ui/')));
  }
});

test('installs multiple packs, merges dependencies, records state, and is idempotent', async () => {
  await withTempRoot(async (root) => {
    const base = await createBaseProject('pack-demo', { outputRoot: root });
    const beforeHome = await readFile(path.join(base.directory, 'src/pages/Home.tsx'), 'utf8');

    const first = await installCapabilityPacks(
      'pack-demo',
      ['data-display', 'feedback', 'navigation'],
      { generatedRoot: root },
    );

    assert.deepEqual(first.installedPacks, ['data-display', 'feedback', 'navigation']);
    assert.deepEqual(first.alreadyInstalledPacks, []);
    assert.ok(first.addedFiles.includes('src/components/ui/card.tsx'));
    assert.ok(first.addedFiles.includes('src/components/ui/sonner.tsx'));
    assert.ok(first.addedFiles.includes('src/components/ui/tabs.tsx'));

    const packageJson = JSON.parse(
      await readFile(path.join(base.directory, 'package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> };
    assert.equal(packageJson.dependencies['@radix-ui/react-progress'], '^1.1.8');
    assert.equal(packageJson.dependencies['@radix-ui/react-tabs'], '^1.1.13');
    assert.equal(packageJson.dependencies.sonner, '^2.0.7');

    const state = await readProjectCapabilityState(base.directory);
    assert.deepEqual(
      state.packs.map((pack) => pack.id),
      ['data-display', 'feedback', 'navigation'],
    );

    const afterHome = await readFile(path.join(base.directory, 'src/pages/Home.tsx'), 'utf8');
    assert.equal(afterHome, beforeHome);

    const second = await installCapabilityPacks(
      'pack-demo',
      ['navigation', 'data-display', 'feedback'],
      { generatedRoot: root },
    );
    assert.deepEqual(second.installedPacks, []);
    assert.deepEqual(second.alreadyInstalledPacks, ['data-display', 'feedback', 'navigation']);
    assert.deepEqual(second.addedFiles, []);
    assert.deepEqual(second.addedDependencies, []);
  });
});

test('refuses to overwrite a different existing Yakable UI file', async () => {
  await withTempRoot(async (root) => {
    const base = await createBaseProject('file-conflict', { outputRoot: root });
    const cardPath = path.join(base.directory, 'src/components/ui/card.tsx');
    await writeFile(cardPath, 'export const Card = "project-custom-card";\n', 'utf8');

    await assert.rejects(
      () => installCapabilityPacks('file-conflict', ['data-display'], { generatedRoot: root }),
      /would overwrite an existing Yakable UI file/,
    );

    assert.equal(
      await readFile(cardPath, 'utf8'),
      'export const Card = "project-custom-card";\n',
    );
  });
});

test('refuses dependency version conflicts instead of silently changing the project', async () => {
  await withTempRoot(async (root) => {
    const base = await createBaseProject('dependency-conflict', { outputRoot: root });
    const packagePath = path.join(base.directory, 'package.json');
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as {
      dependencies: Record<string, string>;
    };
    packageJson.dependencies.sonner = '^1.0.0';
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

    await assert.rejects(
      () => installCapabilityPacks('dependency-conflict', ['feedback'], { generatedRoot: root }),
      /requires sonner@\^2\.0\.7, but the project already declares sonner@\^1\.0\.0/,
    );

    const unchanged = JSON.parse(await readFile(packagePath, 'utf8')) as {
      dependencies: Record<string, string>;
    };
    assert.equal(unchanged.dependencies.sonner, '^1.0.0');
  });
});
