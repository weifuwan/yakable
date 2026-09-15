import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createGeneratedProjectIdentity,
  writeGeneratedProject,
} from '../src/projects/project.js';
import type { GeneratedProject } from '../src/types.js';

const project: GeneratedProject = {
  summary: 'Reserved project identity',
  template: 'website',
  routes: [{ path: '/', title: 'Home' }],
  files: [
    { path: 'package.json', content: '{"scripts":{"dev":"vite"}}' },
    { path: 'index.html', content: '<div id="root"></div>' },
    { path: 'src/main.tsx', content: 'import App from "./App";' },
    { path: 'src/App.tsx', content: 'export default function App() { return <main>Hello</main>; }' },
    { path: 'src/routes.ts', content: 'export const routes = [{ path: "/", title: "Home" }];' },
  ],
};

test('allocates a project identity before source generation is materialized', async () => {
  const createdAt = '2026-09-15T05:00:00.000Z';
  const identity = createGeneratedProjectIdentity('Build a SaaS homepage', createdAt);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'yakable-project-identity-'));
  const outputRoot = path.join(tempRoot, 'generated');

  try {
    assert.match(identity.projectId, /^build-a-saas-homepage-2026-09-15T05-00-00-000Z-[a-f0-9]{8}$/);
    assert.equal(identity.createdAt, createdAt);

    const written = await writeGeneratedProject(
      'Build a SaaS homepage',
      project,
      outputRoot,
      identity,
    );
    const metadata = JSON.parse(
      await readFile(path.join(written.outputDirectory, '.yakable/project.json'), 'utf8'),
    ) as { createdAt?: string };

    assert.equal(path.basename(written.outputDirectory), identity.projectId);
    assert.equal(metadata.createdAt, createdAt);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
