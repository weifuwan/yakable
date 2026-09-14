import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProjectChatMessages,
  generateProjectChatReply,
  parseProjectChatReply,
} from '../src/conversation/project-chat.js';
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
          message: `${route} routing note`,
        }),
      ).route,
      route,
    );
  }
});

test('project message fast path keeps conversational turns out of Frontend Agent edits', () => {
  assert.equal(detectObviousProjectMessageIntent({ userInput: 'good' })?.route, 'CHAT');
  assert.equal(detectObviousProjectMessageIntent({ userInput: 'thanks!' })?.route, 'CHAT');
  assert.equal(detectObviousProjectMessageIntent({ userInput: '不错' })?.route, 'CHAT');
  assert.equal(detectObviousProjectMessageIntent({ userInput: 'who are you?' })?.route, 'CHAT');
  assert.equal(detectObviousProjectMessageIntent({ userInput: '把按钮改成红色' }), null);
});

test('project chat agent keeps recent turns as real multi-turn messages', () => {
  const messages = buildProjectChatMessages({
    mode: 'CHAT',
    userInput: 'why',
    hasGeneratedUi: true,
    recentConversation: [
      { role: 'user', content: 'who are you' },
      {
        role: 'assistant',
        content: "I'm your Yakable project assistant, here to help with this SaaS website project.",
      },
    ],
  });

  assert.deepEqual(
    messages.slice(-3),
    [
      { role: 'user', content: 'who are you' },
      {
        role: 'assistant',
        content: "I'm your Yakable project assistant, here to help with this SaaS website project.",
      },
      { role: 'user', content: 'why' },
    ],
  );
  assert.match(messages[0]?.content ?? '', /continuity/i);
  assert.match(messages[1]?.content ?? '', /"conversationMode": "CHAT"/);
});

test('project chat agent accepts plain-text assistant replies', () => {
  assert.equal(
    parseProjectChatReply('  Because this workspace stays tied to the current project.  '),
    'Because this workspace stays tied to the current project.',
  );
  assert.throws(() => parseProjectChatReply('   '), /empty response/);
});

test('project chat agent omits JSON mode and retries one empty completion', async () => {
  const originalFetch = globalThis.fetch;
  const previousApiKey = process.env.DEEPSEEK_API_KEY;
  const requestBodies: Array<Record<string, unknown>> = [];
  let attempts = 0;

  process.env.DEEPSEEK_API_KEY = 'test-project-chat-key';
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    attempts += 1;
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: attempts === 1 ? '   ' : 'Because I keep this conversation tied to your current project.',
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const reply = await generateProjectChatReply({
      mode: 'CHAT',
      userInput: 'why',
      hasGeneratedUi: true,
      recentConversation: [
        { role: 'user', content: 'who are you' },
        { role: 'assistant', content: "I'm Yakable, your AI interface builder." },
      ],
    });

    assert.equal(attempts, 2);
    assert.equal(reply.message, 'Because I keep this conversation tied to your current project.');
    assert.equal('response_format' in (requestBodies[0] ?? {}), false);
    assert.equal('response_format' in (requestBodies[1] ?? {}), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousApiKey;
  }
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
