import type {
  ModelClient,
  ModelGeneration,
  ModelMessage,
  StructuredModelRequest,
  TextModelRequest,
} from './model-client.js';

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-v4-pro';
const DEFAULT_REQUEST_TIMEOUT_MS = 600_000;
const DEFAULT_MAX_TOKENS = 16_384;
const DEFAULT_THINKING_MODE = 'disabled' as const;

type ThinkingMode = 'enabled' | 'disabled';

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

export type DeepSeekGeneration = ModelGeneration;

export interface DeepSeekRequestConfig {
  baseUrl: string;
  model: string;
  requestTimeoutMs: number;
  maxTokens: number;
  thinkingMode: ThinkingMode;
}

function readPositiveInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function readThinkingMode(env: NodeJS.ProcessEnv): ThinkingMode {
  const raw = env.DEEPSEEK_THINKING?.trim().toLowerCase();
  if (!raw) return DEFAULT_THINKING_MODE;
  if (raw === 'enabled' || raw === 'disabled') return raw;
  throw new Error('DEEPSEEK_THINKING must be either enabled or disabled.');
}

export function resolveDeepSeekRequestConfig(
  env: NodeJS.ProcessEnv = process.env,
): DeepSeekRequestConfig {
  return {
    model: env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL,
    baseUrl: (env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    requestTimeoutMs: readPositiveInteger(env, 'DEEPSEEK_TIMEOUT_MS', DEFAULT_REQUEST_TIMEOUT_MS),
    maxTokens: readPositiveInteger(env, 'DEEPSEEK_MAX_TOKENS', DEFAULT_MAX_TOKENS),
    thinkingMode: readThinkingMode(env),
  };
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'TimeoutError'
    || /aborted due to timeout|timed out|timeout/i.test(error.message)
  );
}

async function requestGeneration(input: {
  messages: ModelMessage[];
  capabilityLabel: string;
  structured: boolean;
  maxTokens?: number;
}): Promise<DeepSeekGeneration> {
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
        messages: input.messages,
        ...(input.structured ? { response_format: { type: 'json_object' } } : {}),
        thinking: { type: config.thinkingMode },
        max_tokens: Math.min(input.maxTokens ?? config.maxTokens, config.maxTokens),
        stream: false,
      }),
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      const seconds = Math.round(config.requestTimeoutMs / 1000);
      throw new Error(
        `DeepSeek request timed out after ${seconds} seconds during ${input.capabilityLabel}. `
          + 'Try again, increase DEEPSEEK_TIMEOUT_MS, or keep DEEPSEEK_THINKING=disabled.',
      );
    }
    throw error;
  }

  const rawBody = await response.text();
  let payload: DeepSeekChatResponse;
  try {
    payload = JSON.parse(rawBody) as DeepSeekChatResponse;
  } catch {
    throw new Error(`DeepSeek returned a non-JSON HTTP response (${response.status}).`);
  }

  if (!response.ok) {
    const message = payload.error?.message?.trim();
    throw new Error(message ? `DeepSeek API error: ${message}` : `DeepSeek API error: HTTP ${response.status}`);
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error(`DeepSeek returned an empty generation during ${input.capabilityLabel}.`);
  return { content, model: config.model };
}

export const deepSeekModelClient: ModelClient = {
  id: 'deepseek',

  generateStructured(request: StructuredModelRequest) {
    return requestGeneration({
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
      capabilityLabel: request.capabilityLabel,
      structured: true,
      maxTokens: request.maxTokens,
    });
  },

  generateText(request: TextModelRequest) {
    return requestGeneration({
      messages: request.messages,
      capabilityLabel: request.capabilityLabel,
      structured: false,
      maxTokens: request.maxTokens,
    });
  },
};
