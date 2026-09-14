import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PAGE_OBSERVATION_MAX_ELEMENTS,
  PAGE_OBSERVATION_MAX_RUNTIME_ERRORS,
  parsePageObservation,
} from '../src/runtime/page-observation.js';
import { PREVIEW_SELECTION_BRIDGE_SCRIPT } from '../src/runtime/preview-selection-bridge.js';

function observationFixture() {
  return {
    version: 1,
    route: '/pricing?plan=pro#compare',
    viewport: {
      width: 1440,
      height: 900,
      scrollX: 0,
      scrollY: 120,
      devicePixelRatio: 2,
    },
    documentSize: {
      width: 1440,
      height: 2400,
    },
    elements: [
      {
        tagName: 'h1',
        text: 'Simple pricing',
        selector: 'main > section > h1',
        rect: {
          left: 120,
          top: 96,
          width: 620,
          height: 72,
        },
        sourceId: 'yak_123456789abc',
        source: {
          file: 'src/pages/Pricing.tsx',
          line: 18,
          column: 7,
        },
      },
    ],
    runtimeErrors: [
      {
        kind: 'error',
        message: 'Example runtime failure',
      },
    ],
    truncated: {
      elements: false,
      runtimeErrors: false,
    },
  };
}

test('parses a bounded source-mapped page observation', () => {
  const observation = parsePageObservation(observationFixture());

  assert.equal(observation.version, 1);
  assert.equal(observation.route, '/pricing?plan=pro#compare');
  assert.equal(observation.viewport.width, 1440);
  assert.equal(observation.documentSize.height, 2400);
  assert.equal(observation.elements.length, 1);
  assert.deepEqual(observation.elements[0]?.source, {
    file: 'src/pages/Pricing.tsx',
    line: 18,
    column: 7,
  });
  assert.equal(observation.runtimeErrors[0]?.kind, 'error');
});

test('rejects observations that exceed element and runtime-error bounds', () => {
  const tooManyElements = observationFixture();
  tooManyElements.elements = Array.from(
    { length: PAGE_OBSERVATION_MAX_ELEMENTS + 1 },
    () => ({
      tagName: 'button',
      text: 'Action',
      selector: 'button',
      rect: { left: 0, top: 0, width: 100, height: 40 },
      sourceId: 'yak_123456789abc',
      source: { file: 'src/App.tsx', line: 1, column: 1 },
    }),
  );
  assert.throws(
    () => parsePageObservation(tooManyElements),
    new RegExp(`at most ${PAGE_OBSERVATION_MAX_ELEMENTS} elements`),
  );

  const tooManyErrors = observationFixture();
  tooManyErrors.runtimeErrors = Array.from(
    { length: PAGE_OBSERVATION_MAX_RUNTIME_ERRORS + 1 },
    () => ({ kind: 'error' as const, message: 'Failure' }),
  );
  assert.throws(
    () => parsePageObservation(tooManyErrors),
    new RegExp(`at most ${PAGE_OBSERVATION_MAX_RUNTIME_ERRORS} runtime errors`),
  );
});

test('preview bridge exposes request-response page observation protocol', () => {
  assert.match(PREVIEW_SELECTION_BRIDGE_SCRIPT, /yakable:request-page-observation/);
  assert.match(PREVIEW_SELECTION_BRIDGE_SCRIPT, /yakable:page-observation/);
  assert.match(
    PREVIEW_SELECTION_BRIDGE_SCRIPT,
    new RegExp(`const OBSERVATION_MAX_ELEMENTS = ${PAGE_OBSERVATION_MAX_ELEMENTS};`),
  );
  assert.match(
    PREVIEW_SELECTION_BRIDGE_SCRIPT,
    new RegExp(`const OBSERVATION_MAX_RUNTIME_ERRORS = ${PAGE_OBSERVATION_MAX_RUNTIME_ERRORS};`),
  );
  assert.match(PREVIEW_SELECTION_BRIDGE_SCRIPT, /data-yakable-source-file/);
  assert.match(PREVIEW_SELECTION_BRIDGE_SCRIPT, /getBoundingClientRect/);
  assert.match(PREVIEW_SELECTION_BRIDGE_SCRIPT, /unhandledrejection/);
});
