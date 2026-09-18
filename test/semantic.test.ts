import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSemanticExpansionRequest,
  parseSemanticExpansion,
} from '../src/prompt-intelligence/semantic.js';
import type { PromptIntent } from '../src/types.js';

const intent: PromptIntent = {
  version: 1,
  productType: 'AI analytics SaaS',
  pageType: 'landing page',
  primaryGoal: 'explain the product and drive trial interest',
  targetAudience: 'data teams',
  styleKeywords: ['高级', '简洁'],
  explicitRequirements: ['include a hero'],
  hardConstraints: ['do not add pricing'],
  missingInformation: ['specific feature list'],
};

test('parses conservative semantic defaults and deduplicates equivalent items', () => {
  const expansion = parseSemanticExpansion(
    JSON.stringify({
      version: 1,
      defaults: [
        {
          kind: 'structure',
          value: ' Clearly explain the core product value early ',
          basis: 'page-pattern',
          confidence: 'high',
        },
        {
          kind: 'structure',
          value: 'Clearly explain the core product value early',
          basis: 'page-pattern',
          confidence: 'medium',
        },
        {
          kind: 'content',
          value: 'Use domain-specific product copy instead of lorem ipsum',
          basis: 'product-pattern',
          confidence: 'high',
        },
      ],
      assumptions: [' Public marketing surface ', 'Public marketing surface'],
      deferredDecisions: ['Whether authentication exists'],
    }),
  );

  assert.equal(expansion.defaults.length, 2);
  assert.equal(expansion.defaults[0]?.value, 'Clearly explain the core product value early');
  assert.equal(expansion.assumptions[0], 'Public marketing surface');
  assert.deepEqual(expansion.deferredDecisions, ['Whether authentication exists']);
});

test('rejects semantic expansion values outside the contract', () => {
  assert.throws(
    () =>
      parseSemanticExpansion(
        JSON.stringify({
          version: 1,
          defaults: [
            {
              kind: 'visual-style',
              value: 'Use a purple gradient',
              basis: 'page-pattern',
              confidence: 'high',
            },
          ],
          assumptions: [],
          deferredDecisions: [],
        }),
      ),
    /invalid default kind/i,
  );
});

test('builds semantic expansion input from the original request and validated intent', () => {
  const request = JSON.parse(
    buildSemanticExpansionRequest('做一个高级简洁的 AI 数据分析产品官网', intent),
  ) as {
    productRequest: string;
    promptIntent: PromptIntent;
  };

  assert.equal(request.productRequest, '做一个高级简洁的 AI 数据分析产品官网');
  assert.deepEqual(request.promptIntent.styleKeywords, ['高级', '简洁']);
  assert.deepEqual(request.promptIntent.hardConstraints, ['do not add pricing']);
});
