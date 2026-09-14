import { resolveDeepSeekRequestConfig } from '../model/deepseek.js';
import type { ProjectConversationMessage } from '../types.js';
import { PROJECT_MESSAGE_INTENT_SYSTEM_PROMPT } from './project-message-prompt.js';

export type ProjectMessageRoute = 'CHAT' | 'CLARIFY' | 'BUILD' | 'EDIT';
export type ProjectMessageConfidence = 'high' | 'medium';

export interface ProjectMessageDecision {
  version: 1;
  route: ProjectMessageRoute;
  confidence: ProjectMessageConfidence;
  message: string;
}

export interface ProjectMessageIntentInput {
  userInput: string;
  hasGeneratedUi: boolean;
  recentConversation: Array<Pick<ProjectConversationMessage, 'role' | 'content'>>;
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
const MAX_RECENT_MESSAGES = 10;
const MAX_RECENT_MESSAGE_LENGTH = 1_500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function usesChinese(value: string): boolean {
  return /[\u3400-\u9fff]/u.test(value);
}

function readRoute(value: unknown): ProjectMessageRoute {
  if (value === 'CHAT' || value === 'CLARIFY' || value === 'BUILD' || value === 'EDIT') {
    return value;
  }
  throw new Error('Project Message Router returned an invalid route.');
}

function readConfidence(value: unknown): ProjectMessageConfidence {
  if (value === 'high' || value === 'medium') return value;
  throw new Error('Project Message Router returned an invalid confidence.');
}

function readMessage(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Project Message Router returned an invalid message.');
  }
  return value.trim().slice(0, 1_200);
}

export function parseProjectMessageDecision(raw: string): ProjectMessageDecision {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Project Message Router returned invalid JSON.');
  }

  if (!isRecord(parsed) || parsed.version !== 1) {
    throw new Error('Project Message Router returned an unsupported decision version.');
  }

  return {
    version: 1,
    route: readRoute(parsed.route),
    confidence: readConfidence(parsed.confidence),
    message: readMessage(parsed.message),
  };
}

export function detectObviousProjectMessageIntent(
  input: Pick<ProjectMessageIntentInput, 'userInput'>,
): ProjectMessageDecision | null {
  const normalized = input.userInput.trim();
  const compact = normalized
    .toLowerCase()
    .replace(/[!！,.，。?？~～\s]+$/u, '')
    .trim();

  const acknowledgements = new Set([
    'good',
    'great',
    'nice',
    'cool',
    'ok',
    'okay',
    'thanks',
    'thank you',
    'got it',
    '好的',
    '好',
    '可以',
    '行',
    '不错',
    '很好',
    '明白了',
    '知道了',
    '谢谢',
  ]);

  if (acknowledgements.has(compact)) {
    return {
      version: 1,
      route: 'CHAT',
      confidence: 'high',
      message: usesChinese(normalized)
        ? '好的。接下来想继续聊，还是开始调整页面？'
        : 'Got it. What would you like to do next?',
    };
  }

  const greetings = new Set(['hi', 'hello', 'hey', '你好', '您好', '嗨', '哈喽']);
  if (greetings.has(compact)) {
    return {
      version: 1,
      route: 'CHAT',
      confidence: 'high',
      message: usesChinese(normalized)
        ? '你好，我在。你可以继续聊，也可以直接告诉我想做或修改什么页面。'
        : 'Hi, I’m here. We can keep chatting, or you can tell me what you want to build or change.',
    };
  }

  return null;
}

function normalizedInput(input: ProjectMessageIntentInput): ProjectMessageIntentInput {
  const userInput = input.userInput.trim();
  if (!userInput) throw new Error('A project message is required.');
  if (userInput.length > MAX_USER_INPUT) {
    throw new Error(`Project message is too long (max ${MAX_USER_INPUT} characters).`);
  }

  return {
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

async function requestProjectMessageDecision(
  input: ProjectMessageIntentInput,
): Promise<ProjectMessageDecision> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is required. Copy .env.example to .env and add your key.');
  }

  const config = resolveDeepSeekRequestConfig();
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
        messages: [
          { role: 'system', content: PROJECT_MESSAGE_INTENT_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(input, null, 2) },
        ],
        response_format: { type: 'json_object' },
        thinking: { type: config.thinkingMode },
        max_tokens: Math.min(config.maxTokens, 2_048),
        stream: false,
      }),
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && /abort|timeout|timed out/i.test(`${error.name} ${error.message}`)) {
      throw new Error('Project Message Router timed out. Please try again.');
    }
    throw error;
  }

  const rawBody = await response.text();
  let payload: DeepSeekChatResponse;
  try {
    payload = JSON.parse(rawBody) as DeepSeekChatResponse;
  } catch {
    throw new Error(`DeepSeek returned a non-JSON response during Project Message Router (${response.status}).`);
  }

  if (!response.ok) {
    const message = payload.error?.message?.trim();
    throw new Error(message ? `DeepSeek API error: ${message}` : `DeepSeek API error: HTTP ${response.status}`);
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Project Message Router returned an empty response.');
  return parseProjectMessageDecision(content);
}

export async function classifyProjectMessageIntent(
  input: ProjectMessageIntentInput,
): Promise<ProjectMessageDecision> {
  const normalized = normalizedInput(input);
  const obvious = detectObviousProjectMessageIntent(normalized);
  if (obvious) return obvious;
  return requestProjectMessageDecision(normalized);
}
