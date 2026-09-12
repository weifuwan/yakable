import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { parseGeneratedProject, slugifyPrompt, writeGeneratedProject } from '../src/project.js';

const validProject = JSON.stringify({
  summary: 'A small generated app',
  template: 'app',
  routes: [
    { path: '/', title: 'Home' },
    { path: '/account', title: 'Account' },
  ],
  files: [
    { path: 'package.json', content: '{"scripts":{"dev":"vite"}}' },
    { path: 'index.html', content: '<div id="root"></div>' },
    { path: 'src/main.tsx', content: 'import App from "./App";' },
    { path: 'src/App.tsx', content: 'export default function App() { return <main>Hello</main>; }' },
    { path: 'src/routes.ts', content: 'export const routes = [{ path: "/", title: "Home" }];' },
  ],
});

test('parses a complete generated project with route metadata', () => {
  const project = parseGeneratedProject(validProject);
  assert.equal(project.files.length, 5);
  assert.equal(project.summary, 'A small generated app');
  assert.equal(project.template, 'app');
  assert.deepEqual(project.routes.map((route) => route.path), ['/', '/account']);
});

test('falls back to a root route for legacy metadata fields', () => {
  const legacy = JSON.stringify({
    summary: 'legacy',
    files: [
      { path: 'package.json', content: '{}' },
      { path: 'index.html', content: '' },
      { path: 'src/main.tsx', content: '' },
      { path: 'src/App.tsx', content: '' },
      { path: 'src/routes.ts', content: 'export const routes = [{ path: "/", title: "Home" }];' },
    ],
  });
  const project = parseGeneratedProject(legacy);
  assert.equal(project.template, 'website');
  assert.deepEqual(project.routes, [{ path: '/', title: 'Home' }]);
});

test('rejects path traversal from model output', () => {
  const dangerous = JSON.stringify({
    summary: 'bad',
    files: [
      { path: 'package.json', content: '{}' },
      { path: 'index.html', content: '' },
      { path: 'src/main.tsx', content: '' },
      { path: 'src/App.tsx', content: '' },
      { path: 'src/routes.ts', content: '' },
      { path: '../outside.txt', content: 'nope' },
    ],
  });

  assert.throws(() => parseGeneratedProject(dangerous), /not safe/);
});

test('rejects incomplete source trees', () => {
  const incomplete = JSON.stringify({
    summary: 'missing entry point',
    files: [{ path: 'package.json', content: '{}' }],
  });

  assert.throws(() => parseGeneratedProject(incomplete), /missing required file/);
});

test('creates a filesystem-safe prompt slug', () => {
  assert.equal(slugifyPrompt('Build a CRM Dashboard!'), 'build-a-crm-dashboard');
  assert.equal(slugifyPrompt('做一个首页'), 'app');
});

test('writes source and .yakable project metadata under a new output root', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'yakable-stage1-'));
  const outputRoot = path.join(tempRoot, 'generated');

  try {
    const project = parseGeneratedProject(validProject);
    const outputDirectory = await writeGeneratedProject('Build a demo', project, outputRoot);
    const appSource = await readFile(path.join(outputDirectory, 'src/App.tsx'), 'utf8');
    const metadata = JSON.parse(
      await readFile(path.join(outputDirectory, '.yakable/project.json'), 'utf8'),
    ) as { template: string; routes: Array<{ path: string }> };

    assert.match(outputDirectory, /build-a-demo-/);
    assert.match(appSource, /Hello/);
    assert.equal(metadata.template, 'app');
    assert.deepEqual(metadata.routes.map((route) => route.path), ['/', '/account']);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
