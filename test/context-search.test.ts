import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  rankProjectSearchFiles,
  resolveProjectContextSearch,
} from '../src/context/project-context-search.js';
import type { EditContextSelection } from '../src/context/project-context-selection.js';
import { resolveProjectEditContext } from '../src/context/project-context.js';

const availableFiles = [
  'src/App.tsx',
  'src/components/Hero.tsx',
  'src/components/Pricing.tsx',
  'src/styles/theme.css',
];

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yakable-context-search-'));
  await mkdir(path.join(root, 'src/components'), { recursive: true });
  await mkdir(path.join(root, 'src/styles'), { recursive: true });
  await writeFile(path.join(root, 'src/App.tsx'), 'export default function App() { return null; }', 'utf8');
  await writeFile(
    path.join(root, 'src/components/Hero.tsx'),
    'export function Hero() { return <h1>Build faster</h1>; }',
    'utf8',
  );
  await writeFile(
    path.join(root, 'src/components/Pricing.tsx'),
    'export function Pricing() { return <><h2>Pricing</h2><button>Start free</button><p>Pricing details</p></>; }',
    'utf8',
  );
  await writeFile(path.join(root, 'src/styles/theme.css'), ':root { --radius: 12px; }', 'utf8');
  return root;
}

test('ranks files with more search matches first', () => {
  const files = rankProjectSearchFiles([
    { path: 'src/components/Hero.tsx', line: 1, column: 1, snippet: 'Pricing' },
    { path: 'src/components/Pricing.tsx', line: 1, column: 1, snippet: 'Pricing' },
    { path: 'src/components/Pricing.tsx', line: 2, column: 1, snippet: 'Pricing' },
  ]);

  assert.deepEqual(files, ['src/components/Pricing.tsx', 'src/components/Hero.tsx']);
});

test('adds search-matched files to the bounded edit context', async () => {
  const root = await createFixture();

  try {
    const selection: EditContextSelection = {
      version: 1,
      relevantFiles: ['src/App.tsx'],
      searchQuery: 'Pricing',
      reason: 'Need to locate the requested pricing UI.',
      source: 'model',
    };

    const resolved = await resolveProjectContextSearch(
      root,
      'Make the pricing CTA stronger',
      availableFiles,
      selection,
    );

    assert.equal(resolved.source, 'search');
    assert.equal(resolved.searchQuery, 'Pricing');
    assert.deepEqual(resolved.relevantFiles.slice(0, 2), [
      'src/App.tsx',
      'src/components/Pricing.tsx',
    ]);
    assert.ok(resolved.relevantFiles.length <= 12);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('uses deterministic fallback when a requested search finds no context', async () => {
  const root = await createFixture();

  try {
    const selection: EditContextSelection = {
      version: 1,
      relevantFiles: [],
      searchQuery: 'DefinitelyMissingText',
      reason: 'Paths alone are ambiguous.',
      source: 'model',
    };

    const resolved = await resolveProjectContextSearch(
      root,
      'Make the Hero spacing tighter',
      availableFiles,
      selection,
    );

    assert.equal(resolved.source, 'fallback');
    assert.ok(resolved.relevantFiles.includes('src/components/Hero.tsx'));
    assert.ok(resolved.relevantFiles.length > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('resolves the common project edit context path inside the context layer', async () => {
  const root = await createFixture();

  try {
    const resolved = await resolveProjectEditContext({
      projectDirectory: root,
      userRequest: 'Make this heading larger',
      visualSelections: [
        {
          file: 'src/components/Hero.tsx',
          line: 1,
          column: 1,
          tagName: 'h1',
          text: 'Build faster',
          selector: 'h1',
        },
      ],
    });

    assert.ok(resolved.availableFiles.includes('src/components/Hero.tsx'));
    assert.equal(resolved.contextSelection.source, 'visual');
    assert.deepEqual(resolved.contextSelection.relevantFiles, ['src/components/Hero.tsx']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
