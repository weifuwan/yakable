import { STAGE1_SYSTEM_PROMPT } from './prompt.js';

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-v4-pro';
const REQUEST_TIMEOUT_MS = 180_000;

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

export interface DeepSeekGeneration {
  content: string;
  model: string;
}

export async function requestProjectCode(userPrompt: string): Promise<DeepSeekGeneration> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is required. Copy .env.example to .env and add your key.');
  }

  const model = process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL;
  const baseUrl = (process.env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: STAGE1_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      thinking: { type: 'enabled' },
      reasoning_effort: 'high',
      max_tokens: 32768,
      stream: false,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

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
  if (!content) {
    throw new Error('DeepSeek returned an empty generation.');
  }

  return { content, model };
}
