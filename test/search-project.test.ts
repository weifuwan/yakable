import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  SEARCH_PROJECT_MAX_RESULTS,
  searchProjectTool,
} from '../src/tools/search-project.js';

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yakable-search-project-'));
  await mkdir(path.join(root, 'src/components'), { recursive: true });
  await writeFile(
    path.join(root, 'src/components/Pricing.tsx'),
    [
      'export function Pricing() {',
      '  return <section><h2>Simple pricing</h2><button>Start free</button></section>;',
      '}',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    path.join(root, 'src/components/Hero.tsx'),
    'export function Hero() { return <h1>Start building</h1>; }',
    'utf8',
  );
  await writeFile(path.join(root, '.env'), 'SECRET=Start free', 'utf8');
  return root;
}

test('searches candidate project text and returns bounded source locations', async () => {
  const root = await createFixture();

  try {
    const result = await searchProjectTool.execute(
      {
        query: 'Start free',
        paths: ['src/components/Hero.tsx', 'src/components/Pricing.tsx'],
      },
      { projectDirectory: root },
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.value.query, 'Start free');
    assert.equal(result.value.scannedFiles, 2);
    assert.equal(result.value.truncated, false);
    assert.deepEqual(result.value.matches.map((match) => match.path), [
      'src/components/Pricing.tsx',
    ]);
    assert.equal(result.value.matches[0]?.line, 2);
    assert.ok((result.value.matches[0]?.column ?? 0) > 0);
    assert.match(result.value.matches[0]?.snippet ?? '', /Start free/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('search is case-insensitive and never reads blocked sensitive paths', async () => {
  const root = await createFixture();

  try {
    const result = await searchProjectTool.execute(
      {
        query: 'start free',
        paths: ['.env', 'src/components/Pricing.tsx'],
      },
      { projectDirectory: root },
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.value.scannedFiles, 1);
    assert.deepEqual(new Set(result.value.matches.map((match) => match.path)), new Set([
      'src/components/Pricing.tsx',
    ]));
    assert.ok(!result.value.matches.some((match) => match.snippet.includes('SECRET=')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('validates query, path, and result limits', async () => {
  const root = await createFixture();

  try {
    const emptyQuery = await searchProjectTool.execute(
      { query: '   ', paths: ['src/components/Pricing.tsx'] },
      { projectDirectory: root },
    );
    assert.equal(emptyQuery.ok, false);
    if (!emptyQuery.ok) assert.equal(emptyQuery.error.code, 'INVALID_QUERY');

    const noPaths = await searchProjectTool.execute(
      { query: 'Pricing', paths: [] },
      { projectDirectory: root },
    );
    assert.equal(noPaths.ok, false);
    if (!noPaths.ok) assert.equal(noPaths.error.code, 'INVALID_PATHS');

    const tooManyResults = await searchProjectTool.execute(
      {
        query: 'Pricing',
        paths: ['src/components/Pricing.tsx'],
        maxResults: SEARCH_PROJECT_MAX_RESULTS + 1,
      },
      { projectDirectory: root },
    );
    assert.equal(tooManyResults.ok, false);
    if (!tooManyResults.ok) assert.equal(tooManyResults.error.code, 'INVALID_MAX_RESULTS');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
