export type ConversationRole = 'USER' | 'ASSISTANT';

export interface ConversationMessage {
  id: string;
  role: ConversationRole;
  content: string;
  createdAt: string;
}

export interface ConversationTurn {
  userMessage: ConversationMessage;
  assistantMessage: ConversationMessage;
}
