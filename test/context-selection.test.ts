import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_CONTEXT_SEARCH_QUERY_LENGTH,
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

test('builds selection request from paths, edit intent, and metadata without source contents', () => {
  const request = buildProjectContextSelectionRequest(
    {
      userRequest: 'Make the Hero spacing tighter',
      editIntent: {
        version: 1,
        summary: 'Tighten Hero spacing.',
        scope: 'section',
        targetHints: ['Hero'],
        directives: [
          {
            area: 'spacing-density',
            directive: 'Reduce vertical spacing inside the Hero.',
            basis: 'explicit',
          },
        ],
        preserve: [],
      },
      visualSelections: [],
    },
    availableFiles,
  );
  const parsed = JSON.parse(request) as {
    userRequest: string;
    editIntent: { scope: string; targetHints: string[] };
    availableFiles: string[];
  };

  assert.equal(parsed.userRequest, 'Make the Hero spacing tighter');
  assert.equal(parsed.editIntent.scope, 'section');
  assert.deepEqual(parsed.editIntent.targetHints, ['Hero']);
  assert.deepEqual(parsed.availableFiles, [...availableFiles].sort());
  assert.ok(!request.includes('export default function'));
  assert.ok(!request.includes('file content'));
});

test('parses a small model-selected context and rejects unavailable files', () => {
  const selection = parseProjectContextSelection(
    JSON.stringify({
      version: 1,
      relevantFiles: ['src/components/Hero.tsx', 'src/styles/theme.css'],
      searchQuery: null,
      reason: 'Hero structure and shared styling are relevant.',
    }),
    availableFiles,
  );

  assert.deepEqual(selection.relevantFiles, [
    'src/components/Hero.tsx',
    'src/styles/theme.css',
  ]);
  assert.equal(selection.searchQuery, null);

  assert.throws(
    () =>
      parseProjectContextSelection(
        JSON.stringify({
          version: 1,
          relevantFiles: ['src/components/Invented.tsx'],
          searchQuery: null,
          reason: 'invented',
        }),
        availableFiles,
      ),
    /unavailable file/,
  );
});

test('allows one bounded literal search request when paths are ambiguous', () => {
  const selection = parseProjectContextSelection(
    JSON.stringify({
      version: 1,
      relevantFiles: [],
      searchQuery: 'Start free',
      reason: 'The visible CTA copy can locate the source.',
    }),
    availableFiles,
  );

  assert.deepEqual(selection.relevantFiles, []);
  assert.equal(selection.searchQuery, 'Start free');

  assert.throws(
    () =>
      parseProjectContextSelection(
        JSON.stringify({
          version: 1,
          relevantFiles: [],
          searchQuery: null,
          reason: 'nothing selected',
        }),
        availableFiles,
      ),
    /must return relevantFiles or one searchQuery/,
  );

  assert.throws(
    () =>
      parseProjectContextSelection(
        JSON.stringify({
          version: 1,
          relevantFiles: [],
          searchQuery: 'x'.repeat(MAX_CONTEXT_SEARCH_QUERY_LENGTH + 1),
          reason: 'too long',
        }),
        availableFiles,
      ),
    /searchQuery must contain/,
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
  assert.equal(selection.searchQuery, null);
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
