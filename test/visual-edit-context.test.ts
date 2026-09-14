import assert from 'node:assert/strict';
import test from 'node:test';

import {
  announceUserEditMessageSubmitted,
  buildVisualEditPrompt,
  type PreviewSelection,
} from '../dashboard/src/visual-edit-context.js';

function selection(
  id: string,
  text: string,
  sourceId = 'yak_source_1',
): PreviewSelection {
  return {
    id,
    sourceId,
    source: { file: 'src/components/Hero.tsx', line: 37, column: 5 },
    tagName: 'h1',
    text,
    selector: 'main > section > h1',
  };
}

function parseEnvelope(prompt: string) {
  const lines = prompt.split('\n');
  assert.equal(lines[0], '[[YAKABLE_VISUAL_EDIT_REQUEST]]');
  assert.equal(lines.at(-1), '[[/YAKABLE_VISUAL_EDIT_REQUEST]]');
  return JSON.parse(lines.slice(1, -1).join('\n')) as {
    userRequest: string;
    visualSelections: {
      selectedCount: number;
      mappedTargetCount: number;
      targets: Array<{
        sourceId?: string;
        file: string;
        line: number;
        column: number;
        instanceCount: number;
        instances: Array<{ runtimeId: string; text: string }>;
      }>;
      unmappedSelections: Array<{ runtimeId: string }>;
    };
  };
}

test('keeps normal project edit prompts unchanged without visual selections', () => {
  assert.equal(buildVisualEditPrompt('Make the hero smaller', []), 'Make the hero smaller');
});

test('groups repeated runtime instances by deterministic source target', () => {
  const prompt = buildVisualEditPrompt('Make the selected heading smaller', [
    selection('runtime-1', 'First heading'),
    selection('runtime-2', 'Second heading'),
  ]);
  const envelope = parseEnvelope(prompt);

  assert.equal(envelope.userRequest, 'Make the selected heading smaller');
  assert.equal(envelope.visualSelections.selectedCount, 2);
  assert.equal(envelope.visualSelections.mappedTargetCount, 1);
  assert.equal(envelope.visualSelections.targets[0]?.sourceId, 'yak_source_1');
  assert.equal(envelope.visualSelections.targets[0]?.file, 'src/components/Hero.tsx');
  assert.equal(envelope.visualSelections.targets[0]?.line, 37);
  assert.equal(envelope.visualSelections.targets[0]?.column, 5);
  assert.equal(envelope.visualSelections.targets[0]?.instanceCount, 2);
  assert.deepEqual(
    envelope.visualSelections.targets[0]?.instances.map((item) => item.runtimeId),
    ['runtime-1', 'runtime-2'],
  );
});

test('keeps unmapped DOM selections as fallback context', () => {
  const prompt = buildVisualEditPrompt('Change this area', [
    {
      id: 'runtime-root',
      tagName: 'div',
      text: 'Preview root',
      selector: 'div#root',
    },
  ]);
  const envelope = parseEnvelope(prompt);

  assert.equal(envelope.visualSelections.mappedTargetCount, 0);
  assert.deepEqual(
    envelope.visualSelections.unmappedSelections.map((item) => item.runtimeId),
    ['runtime-root'],
  );
});

test('freezes the submitted message selection snapshot for UI feedback', () => {
  const original = selection('runtime-1', 'Hero heading');
  const detail = announceUserEditMessageSubmitted('  Make this smaller  ', [original]);

  assert.equal(detail.prompt, 'Make this smaller');
  assert.ok(Number.isFinite(new Date(detail.createdAt).getTime()));
  assert.equal(detail.selections[0]?.tagName, 'h1');
  assert.deepEqual(detail.selections[0]?.source, {
    file: 'src/components/Hero.tsx',
    line: 37,
    column: 5,
  });

  if (detail.selections[0]?.source) {
    detail.selections[0].source.line = 99;
  }
  assert.equal(original.source?.line, 37);
});
