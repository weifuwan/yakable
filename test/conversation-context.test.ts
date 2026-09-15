import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProjectChatMessages } from '../src/conversation/project-chat.js';
import {
  CONVERSATION_CONTEXT_MAX_MESSAGE_CHARS,
  CONVERSATION_CONTEXT_MAX_MESSAGES,
  buildConversationContext,
  type ConversationContextMessage,
} from '../src/context/conversation-context.js';

function conversation(count: number): ConversationContextMessage[] {
  return Array.from(
    { length: count },
    (_, index): ConversationContextMessage => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: ` message-${index + 1} `,
    }),
  );
}

test('keeps one shared bounded recent conversation window', () => {
  const context = buildConversationContext(conversation(12));

  assert.equal(context.sourceMessageCount, 12);
  assert.equal(context.messages.length, CONVERSATION_CONTEXT_MAX_MESSAGES);
  assert.equal(context.droppedMessageCount, 2);
  assert.equal(context.truncatedMessageCount, 0);
  assert.equal(context.messages[0]?.content, 'message-3');
  assert.equal(context.messages.at(-1)?.content, 'message-12');
});

test('trims blank messages and caps message content', () => {
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

test('conversation normalization is idempotent', () => {
  const once = buildConversationContext(conversation(14));
  const twice = buildConversationContext(once.messages);

  assert.deepEqual(twice.messages, once.messages);
  assert.equal(twice.truncatedMessageCount, 0);
});

test('Project Chat consumes the shared conversation context policy', () => {
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

  const history = messages.slice(2, -1);
  assert.equal(history.length, CONVERSATION_CONTEXT_MAX_MESSAGES);
  assert.equal(history[0]?.content, 'message-3');
  assert.equal(history.at(-1)?.content.length, CONVERSATION_CONTEXT_MAX_MESSAGE_CHARS);
  assert.deepEqual(messages.at(-1), { role: 'user', content: 'Why?' });
});
