import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_EDIT_INTENT_DIRECTIVES,
  MAX_EDIT_INTENT_TARGET_HINTS,
  buildEditIntentDeltaRequest,
  fallbackEditIntentDelta,
  parseEditIntentDelta,
} from '../src/editing/edit-intent.js';
import type { DesignIntentIR } from '../src/types.js';

const designIntent: DesignIntentIR = {
  version: 1,
  product: {
    type: 'SaaS',
    surface: 'landing-page',
    primaryGoal: 'Explain the product and drive signup',
    targetAudience: 'developers',
  },
  designDirection: 'Restrained developer-tool interface with clear hierarchy and minimal decoration.',
  styleSignals: ['clean', 'restrained'],
  requirements: [],
  directives: [
    {
      area: 'surface-treatment',
      directive: 'Prefer flat surfaces and subtle borders over decorative shadows.',
      basis: 'style-keyword',
      intensity: 'moderate',
      sourceKeywords: ['restrained'],
    },
  ],
  antiPatterns: ['heavy decorative shadows'],
  openQuestions: [],
};

test('parses a bounded normalized frontend edit delta', () => {
  const delta = parseEditIntentDelta(
    JSON.stringify({
      version: 1,
      summary: 'Make the Hero feel more premium without adding decoration.',
      scope: 'section',
      targetHints: ['Hero', 'primary CTA'],
      directives: [
        {
          area: 'visual-hierarchy',
          directive: 'Strengthen heading and CTA hierarchy with restrained scale changes.',
          basis: 'interpreted',
        },
        {
          area: 'spacing-density',
          directive: 'Increase intentional whitespace around the primary message.',
          basis: 'interpreted',
        },
      ],
      preserve: ['existing copy'],
    }),
  );

  assert.equal(delta.scope, 'section');
  assert.equal(delta.directives.length, 2);
  assert.equal(delta.directives[0]?.area, 'visual-hierarchy');
  assert.equal(delta.directives[0]?.basis, 'interpreted');
  assert.deepEqual(delta.targetHints, ['Hero', 'primary CTA']);
  assert.deepEqual(delta.preserve, ['existing copy']);
});

test('builds normalization request from current request, Design Intent, and visual metadata', () => {
  const request = buildEditIntentDeltaRequest({
    userRequest: '这个 Hero 再高级一点，但是文案不要改',
    baselineDesignIntent: designIntent,
    visualSelections: [
      {
        sourceId: 'yak_hero',
        file: 'src/components/Hero.tsx',
        line: 12,
        column: 5,
        tagName: 'section',
        text: 'Build faster',
        selector: 'main > section',
      },
    ],
  });
  const parsed = JSON.parse(request) as {
    userRequest: string;
    baselineDesignIntent: DesignIntentIR;
    visualSelections: Array<{ file?: string; tagName: string }>;
  };

  assert.equal(parsed.userRequest, '这个 Hero 再高级一点，但是文案不要改');
  assert.equal(parsed.baselineDesignIntent.designDirection, designIntent.designDirection);
  assert.equal(parsed.visualSelections[0]?.file, 'src/components/Hero.tsx');
  assert.equal(parsed.visualSelections[0]?.tagName, 'section');
  assert.ok(!request.includes('export default function'));
});

test('rejects unsupported areas and oversized arrays', () => {
  assert.throws(
    () =>
      parseEditIntentDelta(
        JSON.stringify({
          version: 1,
          summary: 'Bad area',
          scope: 'component',
          targetHints: [],
          directives: [{ area: 'backend', directive: 'Change API', basis: 'explicit' }],
          preserve: [],
        }),
      ),
    /invalid directive area/,
  );

  assert.throws(
    () =>
      parseEditIntentDelta(
        JSON.stringify({
          version: 1,
          summary: 'Too many directives',
          scope: 'page',
          targetHints: [],
          directives: Array.from({ length: MAX_EDIT_INTENT_DIRECTIVES + 1 }, () => ({
            area: 'color',
            directive: 'Use blue',
            basis: 'explicit',
          })),
          preserve: [],
        }),
      ),
    /directives must contain/,
  );

  assert.throws(
    () =>
      parseEditIntentDelta(
        JSON.stringify({
          version: 1,
          summary: 'Too many targets',
          scope: 'page',
          targetHints: Array.from({ length: MAX_EDIT_INTENT_TARGET_HINTS + 1 }, (_, index) => `target-${index}`),
          directives: [{ area: 'color', directive: 'Use blue', basis: 'explicit' }],
          preserve: [],
        }),
      ),
    /invalid targetHints/,
  );
});

test('fallback keeps the human request intact and scopes visual edits to the selection', () => {
  const delta = fallbackEditIntentDelta('高级一点', [
    {
      tagName: 'h1',
      text: 'Build faster',
      selector: 'main > h1',
    },
  ]);

  assert.equal(delta.summary, '高级一点');
  assert.equal(delta.scope, 'selection');
  assert.equal(delta.directives[0]?.area, 'component-expression');
  assert.equal(delta.directives[0]?.directive, '高级一点');
  assert.deepEqual(delta.targetHints, ['h1: Build faster']);
});
