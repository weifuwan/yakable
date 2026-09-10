import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ensureProject,
  getProjectSnapshot,
  readProjectFile,
  writeProjectFile,
} from './project-store.js';

test('creates the fixed React/Vite/Tailwind scaffold', () => {
  const projectId = 'project_test_scaffold';
  const project = ensureProject(projectId);
  const paths = project.files.map((file) => file.path);

  assert.ok(paths.includes('package.json'));
  assert.ok(paths.includes('vite.config.ts'));
  assert.ok(paths.includes('src/App.tsx'));
  assert.ok(paths.includes('src/index.css'));
});

test('writes source files but keeps root configuration locked', () => {
  const projectId = 'project_test_writes';
  ensureProject(projectId);

  writeProjectFile(projectId, 'src/components/Hero.tsx', 'export default function Hero() { return <div />; }');
  assert.match(readProjectFile(projectId, 'src/components/Hero.tsx').content, /Hero/);
  assert.ok(getProjectSnapshot(projectId).files.some((file) => file.path === 'src/components/Hero.tsx'));

  assert.throws(
    () => writeProjectFile(projectId, 'package.json', '{}'),
    /Only src\/ and public\/ files are writable/,
  );
  assert.throws(
    () => writeProjectFile(projectId, '../escape.ts', 'nope'),
    /invalid segment/,
  );
});
