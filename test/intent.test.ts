import assert from 'node:assert/strict';
import test from 'node:test';

import { parsePromptIntent } from '../src/prompt-intelligence/intent.js';

test('parses a structured prompt intent without adding design decisions', () => {
  const intent = parsePromptIntent(
    JSON.stringify({
      version: 1,
      productType: 'AI SaaS',
      pageType: 'landing page',
      primaryGoal: 'product marketing',
      targetAudience: null,
      styleKeywords: ['高级', '简洁', '高级', '  '],
      explicitRequirements: ['Hero', '功能介绍'],
      hardConstraints: ['不要使用大面积渐变'],
      missingInformation: ['brandColor', 'targetAudience'],
    }),
  );

  assert.deepEqual(intent, {
    version: 1,
    productType: 'AI SaaS',
    pageType: 'landing page',
    primaryGoal: 'product marketing',
    targetAudience: null,
    styleKeywords: ['高级', '简洁'],
    explicitRequirements: ['Hero', '功能介绍'],
    hardConstraints: ['不要使用大面积渐变'],
    missingInformation: ['brandColor', 'targetAudience'],
  });
});

test('rejects malformed intent output instead of silently guessing', () => {
  assert.throws(
    () =>
      parsePromptIntent(
        JSON.stringify({
          version: 1,
          productType: 'SaaS',
          pageType: 'landing page',
          primaryGoal: 'marketing',
          targetAudience: null,
          styleKeywords: 'premium',
          explicitRequirements: [],
          hardConstraints: [],
          missingInformation: [],
        }),
      ),
    /invalid styleKeywords/,
  );

  assert.throws(() => parsePromptIntent('{not-json'), /invalid JSON/);
});
