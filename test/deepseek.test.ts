import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDeepSeekRequestConfig } from '../src/deepseek.js';

test('uses Stage 1 latency-safe DeepSeek defaults', () => {
  const config = resolveDeepSeekRequestConfig({});

  assert.equal(config.model, 'deepseek-v4-pro');
  assert.equal(config.baseUrl, 'https://api.deepseek.com');
  assert.equal(config.requestTimeoutMs, 600_000);
  assert.equal(config.maxTokens, 16_384);
  assert.equal(config.thinkingMode, 'disabled');
});

test('allows request limits and thinking mode to be configured', () => {
  const config = resolveDeepSeekRequestConfig({
    DEEPSEEK_MODEL: 'deepseek-v4-flash',
    DEEPSEEK_BASE_URL: 'https://example.test/',
    DEEPSEEK_TIMEOUT_MS: '900000',
    DEEPSEEK_MAX_TOKENS: '8192',
    DEEPSEEK_THINKING: 'enabled',
  });

  assert.equal(config.model, 'deepseek-v4-flash');
  assert.equal(config.baseUrl, 'https://example.test');
  assert.equal(config.requestTimeoutMs, 900_000);
  assert.equal(config.maxTokens, 8192);
  assert.equal(config.thinkingMode, 'enabled');
});

test('rejects invalid request configuration', () => {
  assert.throws(
    () => resolveDeepSeekRequestConfig({ DEEPSEEK_TIMEOUT_MS: '0' }),
    /DEEPSEEK_TIMEOUT_MS must be a positive integer/,
  );

  assert.throws(
    () => resolveDeepSeekRequestConfig({ DEEPSEEK_THINKING: 'sometimes' }),
    /DEEPSEEK_THINKING must be either enabled or disabled/,
  );
});
