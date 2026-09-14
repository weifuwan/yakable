import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDesignCriticRequest,
  mergeDeterministicRuntimeFindings,
  parseDesignCriticResult,
} from '../src/editing/design-critic.js';
import type { EditIntentDelta } from '../src/editing/edit-intent.js';
import type { PageObservation } from '../src/runtime/page-observation.js';
import type { DesignIntentIR } from '../src/types.js';

const designIntent: DesignIntentIR = {
  version: 1,
  product: {
    type: 'SaaS',
    surface: 'landing-page',
    primaryGoal: 'Drive signup',
    targetAudience: 'developers',
  },
  designDirection: 'Restrained developer-tool interface with clear hierarchy and minimal decoration.',
  styleSignals: ['clean', 'restrained'],
  requirements: [],
  directives: [
    {
      area: 'visual-hierarchy',
      directive: 'Keep one dominant message and one obvious primary action.',
      basis: 'style-keyword',
      intensity: 'strong',
      sourceKeywords: ['clean'],
    },
  ],
  antiPatterns: ['heavy decorative shadows'],
  openQuestions: [],
};

const editIntent: EditIntentDelta = {
  version: 1,
  summary: 'Make the Hero feel more premium while keeping the copy.',
  scope: 'section',
  targetHints: ['Hero', 'primary CTA'],
  directives: [
    {
      area: 'visual-hierarchy',
      directive: 'Strengthen the primary heading and CTA hierarchy.',
      basis: 'interpreted',
    },
    {
      area: 'surface-treatment',
      directive: 'Keep surfaces restrained instead of adding decoration.',
      basis: 'interpreted',
    },
  ],
  preserve: ['existing copy'],
};

function observationFixture(): PageObservation {
  return {
    version: 1,
    route: '/',
    viewport: {
      width: 1440,
      height: 900,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 2,
    },
    documentSize: {
      width: 1440,
      height: 2200,
    },
    elements: [
      {
        tagName: 'h1',
        text: 'Build faster with Yakable',
        selector: 'main > section > h1',
        rect: { left: 180, top: 160, width: 620, height: 76 },
        sourceId: 'yak_heading',
        source: { file: 'src/components/Hero.tsx', line: 18, column: 7 },
      },
      {
        tagName: 'button',
        text: 'Start building',
        selector: 'main > section > button',
        rect: { left: 180, top: 310, width: 140, height: 44 },
        sourceId: 'yak_cta',
        source: { file: 'src/components/Hero.tsx', line: 27, column: 7 },
      },
    ],
    runtimeErrors: [],
    truncated: {
      elements: false,
      runtimeErrors: false,
    },
  };
}

test('parses a conservative PASS with explicit unverified visual areas', () => {
  const observation = observationFixture();
  const result = parseDesignCriticResult(
    JSON.stringify({
      version: 1,
      status: 'PASS',
      summary: 'No concrete observable mismatch was found in the current viewport.',
      findings: [],
      unverifiedAreas: ['color', 'surface-treatment'],
    }),
    observation,
  );

  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.unverifiedAreas, ['color', 'surface-treatment']);
});

test('parses a FAIL only when findings cite real observation evidence', () => {
  const observation = observationFixture();
  const result = parseDesignCriticResult(
    JSON.stringify({
      version: 1,
      status: 'FAIL',
      summary: 'The Hero hierarchy has an observable issue.',
      findings: [
        {
          area: 'visual-hierarchy',
          severity: 'major',
          message: 'The intended primary action is visually separated too far from the main message.',
          evidenceRefs: ['element:0', 'element:1'],
        },
      ],
      unverifiedAreas: ['surface-treatment'],
    }),
    observation,
  );

  assert.equal(result.status, 'FAIL');
  assert.equal(result.findings[0]?.area, 'visual-hierarchy');
  assert.deepEqual(result.findings[0]?.evidenceRefs, ['element:0', 'element:1']);
});

test('rejects invented evidence and inconsistent PASS/FAIL output', () => {
  const observation = observationFixture();

  assert.throws(
    () =>
      parseDesignCriticResult(
        JSON.stringify({
          version: 1,
          status: 'FAIL',
          summary: 'Invented evidence.',
          findings: [
            {
              area: 'composition',
              severity: 'minor',
              message: 'Unsupported claim.',
              evidenceRefs: ['element:99'],
            },
          ],
          unverifiedAreas: [],
        }),
        observation,
      ),
    /unavailable evidence/,
  );

  assert.throws(
    () =>
      parseDesignCriticResult(
        JSON.stringify({
          version: 1,
          status: 'PASS',
          summary: 'Contradictory output.',
          findings: [
            {
              area: 'content',
              severity: 'minor',
              message: 'This cannot coexist with PASS.',
              evidenceRefs: ['element:0'],
            },
          ],
          unverifiedAreas: [],
        }),
        observation,
      ),
    /PASS cannot contain findings/,
  );
});

test('builds a critic request with stable evidence references', () => {
  const request = buildDesignCriticRequest({
    baselineDesignIntent: designIntent,
    editIntent,
    pageObservation: observationFixture(),
  });
  const parsed = JSON.parse(request) as {
    baselineDesignIntent: DesignIntentIR;
    editIntent: EditIntentDelta;
    pageObservation: {
      evidenceRef: string;
      elements: Array<{ evidenceRef: string; sourceId?: string }>;
      runtimeErrors: Array<{ evidenceRef: string }>;
    };
  };

  assert.equal(parsed.baselineDesignIntent.designDirection, designIntent.designDirection);
  assert.equal(parsed.editIntent.summary, editIntent.summary);
  assert.equal(parsed.pageObservation.evidenceRef, 'page');
  assert.equal(parsed.pageObservation.elements[0]?.evidenceRef, 'element:0');
  assert.equal(parsed.pageObservation.elements[0]?.sourceId, 'yak_heading');
});

test('runtime errors deterministically force FAIL even when the model returned PASS', () => {
  const observation = observationFixture();
  observation.runtimeErrors = [
    {
      kind: 'error',
      message: 'ReferenceError: pricing is not defined',
    },
  ];

  const pass = parseDesignCriticResult(
    JSON.stringify({
      version: 1,
      status: 'PASS',
      summary: 'No model-visible mismatch found.',
      findings: [],
      unverifiedAreas: [],
    }),
    observation,
  );
  const merged = mergeDeterministicRuntimeFindings(pass, observation);

  assert.equal(merged.status, 'FAIL');
  assert.equal(merged.findings[0]?.area, 'runtime');
  assert.deepEqual(merged.findings[0]?.evidenceRefs, ['runtime:0']);
});
