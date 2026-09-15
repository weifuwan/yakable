import { defaultModelClient } from '../model/default-client.js';
import type { ModelClient, ModelMessage } from '../model/model-client.js';
import type { ProjectConversationMessage } from '../types.js';
import { PROJECT_CHAT_SYSTEM_PROMPT } from './project-chat-prompt.js';

export type ProjectChatMode = 'CHAT' | 'CLARIFY';

export interface ProjectChatInput {
  mode: ProjectChatMode;
  userInput: string;
  hasGeneratedUi: boolean;
  recentConversation: Array<Pick<ProjectConversationMessage, 'role' | 'content'>>;
}

export type ProjectChatMessage = ModelMessage;

export interface ProjectChatReply {
  message: string;
  model: string;
}

const MAX_USER_INPUT = 8_000;
const MAX_RECENT_MESSAGES = 12;
const MAX_RECENT_MESSAGE_LENGTH = 2_000;
const MAX_REPLY_LENGTH = 4_000;
const PROJECT_CHAT_MAX_ATTEMPTS = 2;

function normalizeInput(input: ProjectChatInput): ProjectChatInput {
  const userInput = input.userInput.trim();
  if (!userInput) throw new Error('A project chat message is required.');
  if (userInput.length > MAX_USER_INPUT) {
    throw new Error(`Project chat message is too long (max ${MAX_USER_INPUT} characters).`);
  }

  return {
    mode: input.mode,
    userInput,
    hasGeneratedUi: input.hasGeneratedUi,
    recentConversation: input.recentConversation
      .slice(-MAX_RECENT_MESSAGES)
      .map((message) => ({
        role: message.role,
        content: message.content.trim().slice(0, MAX_RECENT_MESSAGE_LENGTH),
      }))
      .filter((message) => message.content.length > 0),
  };
}

export function buildProjectChatMessages(input: ProjectChatInput): ProjectChatMessage[] {
  const normalized = normalizeInput(input);
  return [
    { role: 'system', content: PROJECT_CHAT_SYSTEM_PROMPT },
    {
      role: 'system',
      content: JSON.stringify(
        {
          conversationMode: normalized.mode,
          projectState: { hasGeneratedUi: normalized.hasGeneratedUi },
        },
        null,
        2,
      ),
    },
    ...normalized.recentConversation.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: 'user', content: normalized.userInput },
  ];
}

export function parseProjectChatReply(raw: string): string {
  const content = raw.trim();
  if (!content) throw new Error('Project Chat Agent returned an empty response.');
  return content.slice(0, MAX_REPLY_LENGTH);
}

export async function generateProjectChatReply(
  input: ProjectChatInput,
  modelClient: ModelClient = defaultModelClient,
): Promise<ProjectChatReply> {
  const request = {
    messages: buildProjectChatMessages(input),
    capabilityLabel: 'Project Chat',
    maxTokens: 4_096,
  } as const;

  for (let attempt = 1; attempt <= PROJECT_CHAT_MAX_ATTEMPTS; attempt += 1) {
    const generation = await modelClient.generateText(request);
    if (generation.content.trim()) {
      return {
        message: parseProjectChatReply(generation.content),
        model: generation.model,
      };
    }
    if (attempt === PROJECT_CHAT_MAX_ATTEMPTS) {
      throw new Error('Project Chat Agent returned an empty response after one automatic retry.');
    }
  }

  throw new Error('Project Chat Agent did not complete.');
}
