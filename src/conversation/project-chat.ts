import {
  CONVERSATION_CONTEXT_COMPACTED_MAX_TOKENS,
  buildConversationContext,
  type ConversationContextMessage,
} from '../context/conversation-context.js';
import { truncateTextToEstimatedTokens } from '../context/token-estimator.js';
import { resolveDeepSeekRequestConfig } from '../model/deepseek.js';
import { PROJECT_CHAT_SYSTEM_PROMPT } from './project-chat-prompt.js';

export type ProjectChatMode = 'CHAT' | 'CLARIFY';

export interface ProjectChatInput {
  mode: ProjectChatMode;
  userInput: string;
  hasGeneratedUi: boolean;
  recentConversation: readonly ConversationContextMessage[];
  compactedHistory?: string | null;
}

export interface ProjectChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProjectChatReply {
  message: string;
  model: string;
}

interface NormalizedProjectChatInput extends ProjectChatInput {
  compactedHistory: string | null;
}

interface DeepSeekChatResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
}

const MAX_USER_INPUT = 8_000;
const MAX_REPLY_LENGTH = 4_000;
const PROJECT_CHAT_MAX_ATTEMPTS = 2;

function normalizeInput(input: ProjectChatInput): NormalizedProjectChatInput {
  const userInput = input.userInput.trim();
  if (!userInput) throw new Error('A project chat message is required.');
  if (userInput.length > MAX_USER_INPUT) {
    throw new Error(`Project chat message is too long (max ${MAX_USER_INPUT} characters).`);
  }

  const context = buildConversationContext(input.recentConversation);
  const suppliedCompactedHistory = input.compactedHistory?.trim();
  const compactedHistory = suppliedCompactedHistory
    ? truncateTextToEstimatedTokens(
        suppliedCompactedHistory,
        CONVERSATION_CONTEXT_COMPACTED_MAX_TOKENS,
      ).text || null
    : context.compactedHistory;

  return {
    mode: input.mode,
    userInput,
    hasGeneratedUi: input.hasGeneratedUi,
    recentConversation: context.messages,
    compactedHistory,
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
          projectState: {
            hasGeneratedUi: normalized.hasGeneratedUi,
          },
          conversationContext: {
            compactedHistory: normalized.compactedHistory,
          },
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
  if (!content) {
    throw new Error('Project Chat Agent returned an empty response.');
  }
  return content.slice(0, MAX_REPLY_LENGTH);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && /abort|timeout|timed out/i.test(`${error.name} ${error.message}`);
}

async function requestProjectChatCompletion(
  apiKey: string,
  input: ProjectChatInput,
): Promise<ProjectChatReply> {
  const config = resolveDeepSeekRequestConfig();
  const messages = buildProjectChatMessages(input);

  for (let attempt = 1; attempt <= PROJECT_CHAT_MAX_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          thinking: { type: config.thinkingMode },
          max_tokens: Math.min(config.maxTokens, 4_096),
          stream: false,
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new Error('Project Chat Agent timed out. Please try again.');
      }
      throw error;
    }

    const rawBody = await response.text();
    let payload: DeepSeekChatResponse;
    try {
      payload = JSON.parse(rawBody) as DeepSeekChatResponse;
    } catch {
      throw new Error(`DeepSeek returned a non-JSON response during Project Chat (${response.status}).`);
    }

    if (!response.ok) {
      const message = payload.error?.message?.trim();
      throw new Error(message ? `DeepSeek API error: ${message}` : `DeepSeek API error: HTTP ${response.status}`);
    }

    const content = payload.choices?.[0]?.message?.content ?? '';
    if (content.trim()) {
      return {
        message: parseProjectChatReply(content),
        model: config.model,
      };
    }

    if (attempt === PROJECT_CHAT_MAX_ATTEMPTS) {
      throw new Error('Project Chat Agent returned an empty response after one automatic retry.');
    }
  }

  throw new Error('Project Chat Agent did not complete.');
}

export async function generateProjectChatReply(input: ProjectChatInput): Promise<ProjectChatReply> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is required. Copy .env.example to .env and add your key.');
  }

  return requestProjectChatCompletion(apiKey, input);
}
