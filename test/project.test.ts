import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  parseGeneratedProject,
  slugifyPrompt,
  writeGeneratedProject,
  writeGeneratedProjectFromBase,
} from '../src/projects/project.js';
import { workspaceChangedPaths } from '../src/workspace/change-set.js';

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

const baseOverlayProject = JSON.stringify({
  summary: 'A data sync workspace implemented on Yakable Base',
  template: 'app',
  routes: [
    { path: '/', title: 'Overview' },
    { path: '/connections', title: 'Connections' },
  ],
  files: [
    {
      path: 'src/App.tsx',
      content:
        'import { OverviewPage } from "@/pages/OverviewPage"; export default function App() { return <OverviewPage />; }',
    },
    {
      path: 'src/routes.ts',
      content:
        'export const routes = [{ path: "/", title: "Overview" }, { path: "/connections", title: "Connections" }] as const;',
    },
    {
      path: 'src/pages/OverviewPage.tsx',
      content:
        'export function OverviewPage() { return <main className="min-h-screen bg-background text-foreground">Overview</main>; }',
    },
    {
      path: 'src/components/product/Sidebar.tsx',
      content:
        'export function Sidebar() { return <aside className="border-r border-border">Navigation</aside>; }',
    },
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

test('parses Base overlays using only project-owned paths', () => {
  const project = parseGeneratedProject(baseOverlayProject, {
    mode: 'base-overlay',
    expectedTemplate: 'app',
  });
  assert.equal(project.template, 'app');
  assert.ok(project.files.some((file) => file.path === 'src/pages/OverviewPage.tsx'));
  assert.ok(project.files.every((file) => file.path !== 'package.json'));
});

test('rejects infrastructure writes, component CSS, and misplaced pages in Base overlays', () => {
  const parsedBase = JSON.parse(baseOverlayProject) as {
    summary: string;
    template: string;
    routes: unknown[];
    files: Array<{ path: string; content: string }>;
  };

  const infrastructureWrite = JSON.stringify({
    ...parsedBase,
    files: [...parsedBase.files, { path: 'package.json', content: '{}' }],
  });
  assert.throws(
    () => parseGeneratedProject(infrastructureWrite, { mode: 'base-overlay', expectedTemplate: 'app' }),
    /project-owned files/,
  );

  const componentCss = JSON.stringify({
    ...parsedBase,
    files: [
      ...parsedBase.files,
      { path: 'src/components/product/IconButton.css', content: '.button { display: inline-flex; }' },
    ],
  });
  assert.throws(
    () => parseGeneratedProject(componentCss, { mode: 'base-overlay', expectedTemplate: 'app' }),
    /must use Tailwind utilities/,
  );

  const misplacedPage = JSON.stringify({
    ...parsedBase,
    files: [
      ...parsedBase.files,
      { path: 'src/components/product/JobsPage.tsx', content: 'export function JobsPage() { return null; }' },
    ],
  });
  assert.throws(
    () => parseGeneratedProject(misplacedPage, { mode: 'base-overlay', expectedTemplate: 'app' }),
    /Route-level page files must live under src\/pages/,
  );
});

test('creates a filesystem-safe prompt slug', () => {
  assert.equal(slugifyPrompt('Build a CRM Dashboard!'), 'build-a-crm-dashboard');
  assert.equal(slugifyPrompt('做一个首页'), 'app');
});

test('writes source as one ChangeSet and persists project metadata', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'yakable-generation-'));
  const outputRoot = path.join(tempRoot, 'generated');

  try {
    const project = parseGeneratedProject(validProject);
    const written = await writeGeneratedProject('Build a demo', project, outputRoot);
    const { outputDirectory, changeSet } = written;
    const appSource = await readFile(path.join(outputDirectory, 'src/App.tsx'), 'utf8');
    const metadata = JSON.parse(
      await readFile(path.join(outputDirectory, '.yakable/project.json'), 'utf8'),
    ) as { template: string; routes: Array<{ path: string }> };

    assert.match(outputDirectory, /build-a-demo-/);
    assert.deepEqual(workspaceChangedPaths(changeSet), project.files.map((file) => file.path));
    assert.ok(changeSet.files.every((file) => file.type === 'ADDED'));
    assert.match(appSource, /Hello/);
    assert.equal(metadata.template, 'app');
    assert.deepEqual(metadata.routes.map((route) => route.path), ['/', '/account']);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('bootstraps Yakable Base and applies the product overlay as one ChangeSet', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'yakable-base-generation-'));
  const outputRoot = path.join(tempRoot, 'generated');

  try {
    const project = parseGeneratedProject(baseOverlayProject, {
      mode: 'base-overlay',
      expectedTemplate: 'app',
    });
    const written = await writeGeneratedProjectFromBase(
      '帮我做一个数据同步的项目',
      project,
      outputRoot,
    );
    const { outputDirectory, changeSet } = written;

    const packageJson = JSON.parse(
      await readFile(path.join(outputDirectory, 'package.json'), 'utf8'),
    ) as { devDependencies?: Record<string, string> };
    const viteConfig = await readFile(path.join(outputDirectory, 'vite.config.ts'), 'utf8');
    const globalStyles = await readFile(path.join(outputDirectory, 'src/styles.css'), 'utf8');
    const pageSource = await readFile(
      path.join(outputDirectory, 'src/pages/OverviewPage.tsx'),
      'utf8',
    );
    const metadata = JSON.parse(
      await readFile(path.join(outputDirectory, '.yakable/project.json'), 'utf8'),
    ) as { template: string; routes: Array<{ path: string }> };
    const strayCss = await stat(
      path.join(outputDirectory, 'src/components/IconButton.css'),
    ).catch(() => null);

    assert.deepEqual(workspaceChangedPaths(changeSet), project.files.map((file) => file.path));
    assert.equal(changeSet.files.find((file) => file.path === 'src/App.tsx')?.type, 'MODIFIED');
    assert.equal(changeSet.files.find((file) => file.path === 'src/pages/OverviewPage.tsx')?.type, 'ADDED');
    assert.equal(packageJson.devDependencies?.tailwindcss, '^4.1.0');
    assert.equal(packageJson.devDependencies?.['@tailwindcss/vite'], '^4.1.0');
    assert.match(viteConfig, /@tailwindcss\/vite/);
    assert.match(globalStyles, /@import "tailwindcss"/);
    assert.match(pageSource, /className=/);
    assert.equal(metadata.template, 'app');
    assert.deepEqual(metadata.routes.map((route) => route.path), ['/', '/connections']);
    assert.equal(strayCss, null);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
