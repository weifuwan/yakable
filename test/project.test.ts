import assert from 'node:assert/strict';
import test from 'node:test';

import { parseGeneratedProject, slugifyPrompt } from '../src/project.js';

const validProject = JSON.stringify({
  summary: 'A small generated app',
  files: [
    { path: 'package.json', content: '{"scripts":{"dev":"vite"}}' },
    { path: 'index.html', content: '<div id="root"></div>' },
    { path: 'src/main.tsx', content: 'import "./App.js";' },
    { path: 'src/App.tsx', content: 'export default function App() { return <main>Hello</main>; }' },
  ],
});

test('parses a complete generated project', () => {
  const project = parseGeneratedProject(validProject);
  assert.equal(project.files.length, 4);
  assert.equal(project.summary, 'A small generated app');
});

test('rejects path traversal from model output', () => {
  const dangerous = JSON.stringify({
    summary: 'bad',
    files: [
      { path: 'package.json', content: '{}' },
      { path: 'index.html', content: '' },
      { path: 'src/main.tsx', content: '' },
      { path: 'src/App.tsx', content: '' },
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
