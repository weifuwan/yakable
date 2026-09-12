import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTasteTranslationRequest, parseTasteTranslation } from '../src/taste.js';
import type { PromptIntent, SemanticExpansion } from '../src/types.js';

const promptIntent: PromptIntent = {
  version: 1,
  productType: 'AI analytics SaaS',
  pageType: 'landing page',
  primaryGoal: 'explain the product and drive signups',
  targetAudience: 'data teams',
  styleKeywords: ['高级', '简洁', '不要太模板'],
  explicitRequirements: [],
  hardConstraints: [],
  missingInformation: ['brand color'],
};

const semanticExpansion: SemanticExpansion = {
  version: 1,
  defaults: [
    {
      kind: 'content',
      value: 'Explain the core product value clearly',
      basis: 'goal-pattern',
      confidence: 'high',
    },
  ],
  assumptions: ['The product should communicate analytical credibility'],
  deferredDecisions: ['Whether pricing should be shown'],
};

test('parses contextual taste decisions and deduplicates repeated values', () => {
  const result = parseTasteTranslation(
    JSON.stringify({
      version: 1,
      designDirection: 'Restrained, precise and product-led AI analytics presentation',
      decisions: [
        {
          area: 'visual-hierarchy',
          directive: 'Use one dominant focal point per major view and keep secondary actions visually quiet',
          basis: 'style-keyword',
          intensity: 'strong',
          sourceKeywords: ['高级', '简洁'],
        },
        {
          area: 'visual-hierarchy',
          directive: 'Use one dominant focal point per major view and keep secondary actions visually quiet',
          basis: 'style-keyword',
          intensity: 'strong',
          sourceKeywords: ['高级'],
        },
      ],
      antiPatterns: ['repetitive equal-card grids', 'repetitive equal-card grids'],
      unresolvedDecisions: ['Exact brand palette', 'Exact brand palette'],
    }),
  );

  assert.equal(result.version, 1);
  assert.equal(result.decisions.length, 1);
  assert.deepEqual(result.decisions[0]?.sourceKeywords, ['高级', '简洁']);
  assert.deepEqual(result.antiPatterns, ['repetitive equal-card grids']);
  assert.deepEqual(result.unresolvedDecisions, ['Exact brand palette']);
});

test('rejects unsupported taste decision areas', () => {
  assert.throws(
    () =>
      parseTasteTranslation(
        JSON.stringify({
          version: 1,
          designDirection: 'Focused',
          decisions: [
            {
              area: 'pricing-strategy',
              directive: 'Make pricing expensive',
              basis: 'product-context',
              intensity: 'moderate',
              sourceKeywords: [],
            },
          ],
          antiPatterns: [],
          unresolvedDecisions: [],
        }),
      ),
    /invalid decision area/,
  );
});

test('builds a taste request without losing the original prompt intelligence context', () => {
  const request = JSON.parse(
    buildTasteTranslationRequest(
      '做一个高级、简洁、不要太模板的 AI 数据分析 SaaS 官网',
      promptIntent,
      semanticExpansion,
    ),
  ) as {
    productRequest: string;
    promptIntent: PromptIntent;
    semanticExpansion: SemanticExpansion;
  };

  assert.equal(request.productRequest, '做一个高级、简洁、不要太模板的 AI 数据分析 SaaS 官网');
  assert.deepEqual(request.promptIntent.styleKeywords, ['高级', '简洁', '不要太模板']);
  assert.equal(request.semanticExpansion.defaults[0]?.kind, 'content');
  assert.equal(request.semanticExpansion.deferredDecisions[0], 'Whether pricing should be shown');
});
