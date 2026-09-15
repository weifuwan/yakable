import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertModelRequestWithinBudget,
  estimateModelRequestTokens,
} from '../src/context/model-request-budget.js';

test('estimates the complete model-visible message list', () => {
  const systemOnly = estimateModelRequestTokens([
    { role: 'system', content: 'Keep the response concise.' },
  ]);
  const completeRequest = estimateModelRequestTokens([
    { role: 'system', content: 'Keep the response concise.' },
    { role: 'assistant', content: 'Earlier answer.' },
    { role: 'user', content: 'Now update the dashboard.' },
  ]);

  assert.ok(systemOnly > 0);
  assert.ok(completeRequest > systemOnly);
});

test('reserves output capacity when checking the final request envelope', () => {
  const messages = [
    { role: 'system' as const, content: 'System rules.' },
    { role: 'user' as const, content: '中'.repeat(500) },
  ];

  const result = assertModelRequestWithinBudget({
    messages,
    maxContextTokens: 1_000,
    reservedOutputTokens: 200,
    label: 'Test request',
  });

  assert.equal(result.messageCount, 2);
  assert.equal(result.budget.maxInputTokens, 800);
  assert.equal(result.usage.overBudget, false);
  assert.ok(result.usage.remainingInputTokens > 0);

  assert.throws(
    () => assertModelRequestWithinBudget({
      messages,
      maxContextTokens: 1_000,
      reservedOutputTokens: 600,
      label: 'Test request',
    }),
    /Test request exceeds its Context budget/,
  );
});

test('includes system prompts and current user input in the end-to-end check', () => {
  assert.throws(
    () => assertModelRequestWithinBudget({
      messages: [
        { role: 'system', content: '规'.repeat(700) },
        { role: 'user', content: '改一下页面' },
      ],
      maxContextTokens: 1_000,
      reservedOutputTokens: 250,
      label: 'Final model request',
    }),
    /Final model request exceeds its Context budget/,
  );
});
