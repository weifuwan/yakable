import assert from 'node:assert/strict';
import test from 'node:test';

import { generateProject } from '../src/generation/generate.js';
import {
  BuildIntentGateError,
  detectObviousBuildIntent,
  parseBuildIntentDecision,
} from '../src/prompt-intelligence/build-intent.js';
import {
  detectObviousProjectMessageIntent,
  parseProjectMessageDecision,
} from '../src/prompt-intelligence/project-message.js';

test('parses CREATE / CHAT / CLARIFY Build Intent decisions', () => {
  assert.deepEqual(
    parseBuildIntentDecision(
      JSON.stringify({
        version: 1,
        route: 'CREATE',
        confidence: 'high',
        message: 'Ready to build.',
      }),
    ),
    {
      version: 1,
      route: 'CREATE',
      confidence: 'high',
      message: 'Ready to build.',
    },
  );

  assert.equal(
    parseBuildIntentDecision(
      JSON.stringify({
        version: 1,
        route: 'CHAT',
        confidence: 'medium',
        message: 'Tell me what you want to build.',
      }),
    ).route,
    'CHAT',
  );

  assert.equal(
    parseBuildIntentDecision(
      JSON.stringify({
        version: 1,
        route: 'CLARIFY',
        confidence: 'high',
        message: 'Do you want me to create that as a page?',
      }),
    ).route,
    'CLARIFY',
  );
});

test('rejects invalid Build Intent decisions', () => {
  assert.throws(
    () => parseBuildIntentDecision('{"version":1,"route":"BUILD","confidence":"high","message":"x"}'),
    /invalid route/,
  );
  assert.throws(
    () => parseBuildIntentDecision('{"version":1,"route":"CHAT","confidence":"low","message":"x"}'),
    /invalid confidence/,
  );
  assert.throws(
    () => parseBuildIntentDecision('{"version":1,"route":"CHAT","confidence":"high","message":""}'),
    /invalid message/,
  );
});

test('obvious greetings do not start frontend generation', () => {
  assert.equal(detectObviousBuildIntent('Hello')?.route, 'CHAT');
  assert.equal(detectObviousBuildIntent('hello!')?.route, 'CHAT');
  assert.equal(detectObviousBuildIntent('你好')?.route, 'CHAT');
});

test('bare Hello World inputs require clarification instead of creating', () => {
  assert.equal(detectObviousBuildIntent('Hello World')?.route, 'CLARIFY');
  assert.equal(detectObviousBuildIntent('Hello word')?.route, 'CLARIFY');
  assert.match(
    detectObviousBuildIntent('Hello World')?.message ?? '',
    /Create a Hello World page/i,
  );
});

test('real build requests are left for model routing rather than blocked by fast paths', () => {
  assert.equal(detectObviousBuildIntent('Build a Hello World page'), null);
  assert.equal(detectObviousBuildIntent('帮我做一个 Todo App'), null);
});

test('project message router accepts CHAT / CLARIFY / BUILD / EDIT decisions', () => {
  for (const route of ['CHAT', 'CLARIFY', 'BUILD', 'EDIT'] as const) {
    assert.equal(
      parseProjectMessageDecision(
        JSON.stringify({
          version: 1,
          route,
          confidence: 'high',
          message: route === 'CHAT' ? 'Sure.' : 'Ready.',
        }),
      ).route,
      route,
    );
  }
});

test('project message fast path keeps acknowledgements out of Frontend Agent edits', () => {
  assert.equal(detectObviousProjectMessageIntent({ userInput: 'good' })?.route, 'CHAT');
  assert.equal(detectObviousProjectMessageIntent({ userInput: 'thanks!' })?.route, 'CHAT');
  assert.equal(detectObviousProjectMessageIntent({ userInput: '不错' })?.route, 'CHAT');
  assert.equal(detectObviousProjectMessageIntent({ userInput: '把按钮改成红色' }), null);
});

test('project generation rejects a precomputed non-CREATE decision before downstream generation', async () => {
  await assert.rejects(
    () =>
      generateProject('Hello World', {
        buildIntent: {
          version: 1,
          route: 'CLARIFY',
          confidence: 'high',
          message: 'Do you want me to create a Hello World page?',
        },
      }),
    (error: unknown) =>
      error instanceof BuildIntentGateError && error.decision.route === 'CLARIFY',
  );
});
