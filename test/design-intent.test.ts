import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDesignIntent } from '../src/design-intent.js';
import type { PromptIntent, SemanticExpansion, TasteTranslation } from '../src/types.js';

const promptIntent: PromptIntent = {
  version: 1,
  productType: ' AI analytics SaaS ',
  pageType: ' landing page ',
  primaryGoal: ' explain the product and drive trial ',
  targetAudience: ' data teams ',
  styleKeywords: ['高级', '简洁', '高级'],
  explicitRequirements: ['Show a real product preview', 'Keep one primary CTA'],
  hardConstraints: ['Do not use external image assets'],
  missingInformation: ['Whether pricing should be shown'],
};

const semanticExpansion: SemanticExpansion = {
  version: 1,
  defaults: [
    {
      kind: 'behavior',
      value: 'Keep one primary CTA',
      basis: 'goal-pattern',
      confidence: 'high',
    },
    {
      kind: 'quality',
      value: 'Keep the core message understandable on mobile',
      basis: 'universal',
      confidence: 'high',
    },
  ],
  assumptions: ['The product preview can use representative local sample data'],
  deferredDecisions: ['Whether pricing should be shown', 'Whether social proof is available'],
};

const tasteTranslation: TasteTranslation = {
  version: 1,
  designDirection: ' Restrained, confident and product-led ',
  decisions: [
    {
      area: 'visual-hierarchy',
      directive: 'Make the product value and primary action dominant',
      basis: 'style-keyword',
      intensity: 'strong',
      sourceKeywords: ['高级', '简洁', '高级'],
    },
    {
      area: 'surface-treatment',
      directive: 'Keep decorative surfaces quiet so the product preview carries the visual weight',
      basis: 'product-context',
      intensity: 'moderate',
      sourceKeywords: [],
    },
  ],
  antiPatterns: ['generic purple-blue glow', 'generic purple-blue glow', 'repetitive equal card grids'],
  unresolvedDecisions: ['Whether social proof is available', 'Whether motion should be used'],
};

test('compiles upstream prompt intelligence into one normalized IR', () => {
  const designIntent = buildDesignIntent(promptIntent, semanticExpansion, tasteTranslation);

  assert.equal(designIntent.version, 1);
  assert.deepEqual(designIntent.product, {
    type: 'AI analytics SaaS',
    surface: 'landing page',
    primaryGoal: 'explain the product and drive trial',
    targetAudience: 'data teams',
  });
  assert.equal(designIntent.designDirection, 'Restrained, confident and product-led');
  assert.deepEqual(designIntent.styleSignals, ['高级', '简洁']);
  assert.deepEqual(designIntent.antiPatterns, [
    'generic purple-blue glow',
    'repetitive equal card grids',
  ]);
});

test('preserves user requirements before semantic defaults and deduplicates weaker copies', () => {
  const designIntent = buildDesignIntent(promptIntent, semanticExpansion, tasteTranslation);

  assert.deepEqual(
    designIntent.requirements.map(({ statement, source, kind, confidence }) => ({
      statement,
      source,
      kind,
      confidence,
    })),
    [
      {
        statement: 'Do not use external image assets',
        source: 'user-constraint',
        kind: 'constraint',
        confidence: 'explicit',
      },
      {
        statement: 'Show a real product preview',
        source: 'user-explicit',
        kind: 'requirement',
        confidence: 'explicit',
      },
      {
        statement: 'Keep one primary CTA',
        source: 'user-explicit',
        kind: 'requirement',
        confidence: 'explicit',
      },
      {
        statement: 'Keep the core message understandable on mobile',
        source: 'semantic-default',
        kind: 'quality',
        confidence: 'high',
      },
      {
        statement: 'The product preview can use representative local sample data',
        source: 'semantic-assumption',
        kind: 'assumption',
        confidence: 'high',
      },
    ],
  );
  assert.equal(designIntent.requirements[3]?.basis, 'universal');
});

test('normalizes taste directives and unresolved decisions with provenance', () => {
  const designIntent = buildDesignIntent(promptIntent, semanticExpansion, tasteTranslation);

  assert.deepEqual(designIntent.directives[0], {
    area: 'visual-hierarchy',
    directive: 'Make the product value and primary action dominant',
    basis: 'style-keyword',
    intensity: 'strong',
    sourceKeywords: ['高级', '简洁'],
  });

  assert.deepEqual(designIntent.openQuestions, [
    { value: 'Whether pricing should be shown', source: 'missing-information' },
    { value: 'Whether social proof is available', source: 'semantic-decision' },
    { value: 'Whether motion should be used', source: 'taste-decision' },
  ]);
});

test('rejects unsupported upstream contract versions', () => {
  const unsupportedIntent = { ...promptIntent, version: 2 } as unknown as PromptIntent;
  assert.throws(
    () => buildDesignIntent(unsupportedIntent, semanticExpansion, tasteTranslation),
    /unsupported intent version/,
  );
});
