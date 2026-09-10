import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ensureProject,
  getProjectSnapshot,
  readProjectFile,
  writeProjectFile,
} from '../project/project-store.js';
import {
  captureStableVersion,
  getProjectVersionDiff,
  listProjectVersions,
  rollbackProjectVersion,
} from './version-store.js';

test('captures stable versions, skips duplicates, and exposes compact diffs', () => {
  const projectId = 'project_version_capture_test';
  ensureProject(projectId);
  writeProjectFile(
    projectId,
    'src/App.tsx',
    'export default function App(){return <main>Version one</main>}',
  );

  const first = captureStableVersion(projectId, {
    label: 'Build the first landing page',
    origin: 'agent',
  });
  assert.equal(first.created, true);
  assert.equal(first.version.id, 'v1');

  const duplicate = captureStableVersion(projectId, {
    label: 'No source change',
    origin: 'agent',
  });
  assert.equal(duplicate.created, false);
  assert.equal(listProjectVersions(projectId).length, 1);

  writeProjectFile(
    projectId,
    'src/App.tsx',
    'export default function App(){return <main>Version two</main>}',
  );
  writeProjectFile(
    projectId,
    'src/components/Hero.tsx',
    'export default function Hero(){return <section>Hero</section>}',
  );

  const second = captureStableVersion(projectId, {
    label: 'Refine the hero',
    origin: 'agent',
  });
  assert.equal(second.version.id, 'v2');
  assert.deepEqual(second.version.changedFiles.sort(), [
    'src/App.tsx',
    'src/components/Hero.tsx',
  ]);

  const diff = getProjectVersionDiff(projectId, 'v2');
  assert.equal(diff.against?.id, 'v1');
  assert.ok(diff.files.some((file) => file.path === 'src/App.tsx' && file.status === 'modified'));
  assert.ok(
    diff.files.some(
      (file) => file.path === 'src/components/Hero.tsx' && file.status === 'added',
    ),
  );
});

test('rollback restores an earlier stable source set without changing locked config', () => {
  const projectId = 'project_version_rollback_test';
  ensureProject(projectId);
  const packageBefore = readProjectFile(projectId, 'package.json').content;

  writeProjectFile(
    projectId,
    'src/App.tsx',
    'export default function App(){return <main>Stable one</main>}',
  );
  captureStableVersion(projectId, { label: 'Stable one', origin: 'agent' });

  writeProjectFile(
    projectId,
    'src/App.tsx',
    'export default function App(){return <main>Stable two</main>}',
  );
  writeProjectFile(
    projectId,
    'src/components/Temporary.tsx',
    'export default function Temporary(){return <div>Temporary</div>}',
  );
  captureStableVersion(projectId, { label: 'Stable two', origin: 'agent' });

  const rollback = rollbackProjectVersion(projectId, 'v1');
  assert.ok(rollback.changedFiles.includes('src/App.tsx'));
  assert.ok(rollback.changedFiles.includes('src/components/Temporary.tsx'));
  assert.match(readProjectFile(projectId, 'src/App.tsx').content, /Stable one/);
  assert.throws(
    () => readProjectFile(projectId, 'src/components/Temporary.tsx'),
    /File not found/,
  );
  assert.equal(readProjectFile(projectId, 'package.json').content, packageBefore);
  assert.ok(!getProjectSnapshot(projectId).files.some((file) => file.path === 'src/components/Temporary.tsx'));

  const revertVersion = captureStableVersion(projectId, {
    label: 'Rollback to v1',
    origin: 'rollback',
    sourceVersionId: 'v1',
  });
  assert.equal(revertVersion.created, true);
  assert.equal(revertVersion.version.id, 'v3');
  assert.equal(revertVersion.version.origin, 'rollback');
  assert.equal(revertVersion.version.sourceVersionId, 'v1');
});
