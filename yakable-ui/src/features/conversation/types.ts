export type ConversationRole = 'USER' | 'ASSISTANT';

export interface ConversationMessage {
  id: string;
  role: ConversationRole;
  content: string;
  createdAt: string;
}
