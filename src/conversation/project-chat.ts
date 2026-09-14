import { resolveDeepSeekRequestConfig } from '../model/deepseek.js';
import type { ProjectConversationMessage } from '../types.js';
import { PROJECT_CHAT_SYSTEM_PROMPT } from './project-chat-prompt.js';

export type ProjectChatMode = 'CHAT' | 'CLARIFY';

export interface ProjectChatInput {
  mode: ProjectChatMode;
  userInput: string;
  hasGeneratedUi: boolean;
  recentConversation: Array<Pick<ProjectConversationMessage, 'role' | 'content'>>;
}

export interface ProjectChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProjectChatReply {
  message: string;
  model: string;
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
const MAX_RECENT_MESSAGES = 12;
const MAX_RECENT_MESSAGE_LENGTH = 2_000;
const MAX_REPLY_LENGTH = 4_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
          projectState: {
            hasGeneratedUi: normalized.hasGeneratedUi,
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Project Chat Agent returned invalid JSON.');
  }

  if (!isRecord(parsed) || typeof parsed.message !== 'string' || !parsed.message.trim()) {
    throw new Error('Project Chat Agent returned an invalid message.');
  }

  return parsed.message.trim().slice(0, MAX_REPLY_LENGTH);
}

export async function generateProjectChatReply(input: ProjectChatInput): Promise<ProjectChatReply> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is required. Copy .env.example to .env and add your key.');
  }

  const config = resolveDeepSeekRequestConfig();
  const messages = buildProjectChatMessages(input);
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
        response_format: { type: 'json_object' },
        thinking: { type: config.thinkingMode },
        max_tokens: Math.min(config.maxTokens, 4_096),
        stream: false,
      }),
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && /abort|timeout|timed out/i.test(`${error.name} ${error.message}`)) {
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

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Project Chat Agent returned an empty response.');

  return {
    message: parseProjectChatReply(content),
    model: config.model,
  };
}
