import type { ProjectConversationMessage } from '../types.js';

export const CONVERSATION_CONTEXT_VERSION = 1 as const;
export const CONVERSATION_CONTEXT_MAX_MESSAGES = 10;
export const CONVERSATION_CONTEXT_MAX_MESSAGE_CHARS = 1_500;

export type ConversationContextMessage = Pick<
  ProjectConversationMessage,
  'role' | 'content'
>;

export interface ConversationContext {
  version: typeof CONVERSATION_CONTEXT_VERSION;
  messages: readonly ConversationContextMessage[];
  sourceMessageCount: number;
  droppedMessageCount: number;
  truncatedMessageCount: number;
}

/**
 * Build the bounded recent conversation supplied to model calls.
 *
 * This intentionally preserves the current product behavior: only the latest
 * ten persisted user/assistant messages are considered and each message is
 * capped at 1,500 characters. Older turns remain in project persistence; they
 * are simply not part of the current model context.
 */
export function buildConversationContext(
  messages: readonly ConversationContextMessage[],
): ConversationContext {
  const recent = messages.slice(-CONVERSATION_CONTEXT_MAX_MESSAGES);
  const normalized: ConversationContextMessage[] = [];
  let truncatedMessageCount = 0;

  for (const message of recent) {
    const content = message.content.trim();
    if (!content) continue;
    if (content.length > CONVERSATION_CONTEXT_MAX_MESSAGE_CHARS) {
      truncatedMessageCount += 1;
    }
    normalized.push({
      role: message.role,
      content: content.slice(0, CONVERSATION_CONTEXT_MAX_MESSAGE_CHARS),
    });
  }

  return {
    version: CONVERSATION_CONTEXT_VERSION,
    messages: normalized,
    sourceMessageCount: messages.length,
    droppedMessageCount: messages.length - normalized.length,
    truncatedMessageCount,
  };
}
