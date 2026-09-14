import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProjectContextSelectionRequest,
  fallbackEditContextFiles,
  parseProjectContextSelection,
  selectMappedVisualContextFiles,
  selectProjectContextFiles,
} from '../src/editing/context-selection.js';

const availableFiles = [
  'index.html',
  'package.json',
  'src/App.tsx',
  'src/components/Hero.tsx',
  'src/components/Pricing.tsx',
  'src/pages/Dashboard.tsx',
  'src/styles/theme.css',
];

test('builds selection request from paths and metadata without source contents', () => {
  const request = buildProjectContextSelectionRequest(
    {
      userRequest: 'Make the Hero spacing tighter',
      visualSelections: [],
    },
    availableFiles,
  );
  const parsed = JSON.parse(request) as {
    userRequest: string;
    availableFiles: string[];
  };

  assert.equal(parsed.userRequest, 'Make the Hero spacing tighter');
  assert.deepEqual(parsed.availableFiles, [...availableFiles].sort());
  assert.ok(!request.includes('export default function'));
  assert.ok(!request.includes('file content'));
});

test('parses a small model-selected context and rejects unavailable files', () => {
  const selection = parseProjectContextSelection(
    JSON.stringify({
      version: 1,
      relevantFiles: ['src/components/Hero.tsx', 'src/styles/theme.css'],
      reason: 'Hero structure and shared styling are relevant.',
    }),
    availableFiles,
  );

  assert.deepEqual(selection.relevantFiles, [
    'src/components/Hero.tsx',
    'src/styles/theme.css',
  ]);

  assert.throws(
    () =>
      parseProjectContextSelection(
        JSON.stringify({
          version: 1,
          relevantFiles: ['src/components/Invented.tsx'],
          reason: 'invented',
        }),
        availableFiles,
      ),
    /unavailable file/,
  );
});

test('uses mapped Visual Edit source files directly', async () => {
  const visualSelections = [
    {
      file: 'src/components/Hero.tsx',
      line: 12,
      column: 3,
      tagName: 'h1',
      text: 'Build faster',
      selector: 'main > h1',
    },
    {
      file: 'src/components/Hero.tsx',
      line: 21,
      column: 3,
      tagName: 'p',
      text: 'Ship with confidence',
      selector: 'main > p',
    },
  ];

  assert.deepEqual(
    selectMappedVisualContextFiles(visualSelections, availableFiles),
    ['src/components/Hero.tsx'],
  );

  const selection = await selectProjectContextFiles(
    {
      userRequest: 'Make this heading larger',
      visualSelections,
    },
    availableFiles,
  );

  assert.equal(selection.source, 'visual');
  assert.deepEqual(selection.relevantFiles, ['src/components/Hero.tsx']);
});

test('fallback prefers filename matches and shared styles for styling requests', () => {
  const files = fallbackEditContextFiles(
    'Make the Hero color and spacing more restrained',
    availableFiles,
  );

  assert.equal(files[0], 'src/components/Hero.tsx');
  assert.ok(files.includes('src/styles/theme.css'));
  assert.ok(files.length <= 8);
});
