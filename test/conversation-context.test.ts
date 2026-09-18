import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProjectChatMessages } from '../src/conversation/project-chat.js';
import {
  CONVERSATION_CONTEXT_HISTORY_MAX_TOKENS,
  CONVERSATION_CONTEXT_MAX_MESSAGE_CHARS,
  CONVERSATION_CONTEXT_MAX_MESSAGES,
  buildConversationContext,
  type ConversationContextMessage,
} from '../src/context/conversation-context.js';
import {
  estimateTextTokens,
  truncateTextToEstimatedTokens,
} from '../src/context/token-estimator.js';
import { buildProjectMessageContextInput } from '../src/prompt-intelligence/project-message.js';

function conversation(count: number): ConversationContextMessage[] {
  return Array.from(
    { length: count },
    (_, index): ConversationContextMessage => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: ` message-${index + 1} `,
    }),
  );
}

test('keeps recent turns verbatim and compacts older conversation', () => {
  const context = buildConversationContext(conversation(12));

  assert.equal(context.sourceMessageCount, 12);
  assert.equal(context.messages.length, CONVERSATION_CONTEXT_MAX_MESSAGES);
  assert.equal(context.recentMessageCount, CONVERSATION_CONTEXT_MAX_MESSAGES);
  assert.equal(context.compactedMessageCount, 2);
  assert.equal(context.droppedMessageCount, 0);
  assert.equal(context.truncatedMessageCount, 0);
  assert.equal(context.messages[0]?.content, 'message-3');
  assert.equal(context.messages.at(-1)?.content, 'message-12');
  assert.match(context.compactedHistory ?? '', /message-1/);
  assert.match(context.compactedHistory ?? '', /message-2/);
});

test('trims blank messages and caps recent message content', () => {
  const longContent = `  ${'x'.repeat(CONVERSATION_CONTEXT_MAX_MESSAGE_CHARS + 50)}  `;
  const context = buildConversationContext([
    { role: 'user', content: '   ' },
    { role: 'assistant', content: longContent },
  ]);

  assert.equal(context.messages.length, 1);
  assert.equal(context.messages[0]?.role, 'assistant');
  assert.equal(context.messages[0]?.content.length, CONVERSATION_CONTEXT_MAX_MESSAGE_CHARS);
  assert.equal(context.droppedMessageCount, 1);
  assert.equal(context.truncatedMessageCount, 1);
});

test('bounds a 100-message mixed-language conversation by estimated tokens', () => {
  const history = Array.from(
    { length: 100 },
    (_, index): ConversationContextMessage => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content:
        index % 3 === 0
          ? `第${index + 1}轮：${'这是较长的中文上下文。'.repeat(120)}`
          : `turn-${index + 1}: ${'frontend context '.repeat(180)}`,
    }),
  );

  const context = buildConversationContext(history);

  assert.equal(context.sourceMessageCount, 100);
  assert.ok(context.messages.length > 0);
  assert.ok(context.messages.length <= CONVERSATION_CONTEXT_MAX_MESSAGES);
  assert.ok(context.compactedHistory);
  assert.ok(context.compactedMessageCount > 0);
  assert.ok(context.droppedMessageCount > 0);
  assert.ok(context.estimatedHistoryTokens <= CONVERSATION_CONTEXT_HISTORY_MAX_TOKENS);
  assert.equal(context.budgetUsage.overBudget, false);
  assert.match(context.messages.at(-1)?.content ?? '', /turn-100|第100轮/);
});

test('token estimator is conservative for CJK and can truncate to a budget', () => {
  assert.equal(estimateTextTokens('abcd'), 1);
  assert.equal(estimateTextTokens('你好世界'), 4);

  const truncated = truncateTextToEstimatedTokens('你好世界'.repeat(20), 10);
  assert.equal(truncated.truncated, true);
  assert.ok(truncated.estimatedTokens <= 10);
  assert.ok(truncated.text.length > 0);
});

test('conversation normalization keeps the recent role-preserving window idempotent', () => {
  const once = buildConversationContext(conversation(14));
  const twice = buildConversationContext(once.messages);

  assert.deepEqual(twice.messages, once.messages);
  assert.equal(twice.truncatedMessageCount, 0);
});

test('Project Message Router input carries both compacted and recent context', () => {
  const normalized = buildProjectMessageContextInput({
    userInput: ' Why? ',
    hasGeneratedUi: true,
    recentConversation: conversation(24),
  });

  assert.equal(normalized.userInput, 'Why?');
  assert.equal(normalized.recentConversation.length, CONVERSATION_CONTEXT_MAX_MESSAGES);
  assert.match(normalized.compactedHistory ?? '', /message-14/);
  assert.equal(normalized.recentConversation[0]?.content, 'message-15');
});

test('Project Chat consumes compacted history and the recent conversation window', () => {
  const recentConversation = conversation(12);
  recentConversation[11] = {
    role: 'assistant',
    content: 'y'.repeat(CONVERSATION_CONTEXT_MAX_MESSAGE_CHARS + 100),
  };

  const messages = buildProjectChatMessages({
    mode: 'CHAT',
    userInput: ' Why? ',
    hasGeneratedUi: true,
    recentConversation,
  });

  const metadata = JSON.parse(messages[1]!.content) as {
    conversationContext: { compactedHistory: string | null };
  };
  const history = messages.slice(2, -1);

  assert.equal(history.length, CONVERSATION_CONTEXT_MAX_MESSAGES);
  assert.equal(history[0]?.content, 'message-3');
  assert.equal(history.at(-1)?.content.length, CONVERSATION_CONTEXT_MAX_MESSAGE_CHARS);
  assert.match(metadata.conversationContext.compactedHistory ?? '', /message-1/);
  assert.deepEqual(messages.at(-1), { role: 'user', content: 'Why?' });
});
