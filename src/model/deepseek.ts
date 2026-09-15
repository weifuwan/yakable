import { assertModelRequestWithinBudget } from '../context/model-request-budget.js';
import { DESIGN_CRITIC_SYSTEM_PROMPT } from '../editing/design-critic-prompt.js';
import { EDIT_INTENT_DELTA_SYSTEM_PROMPT } from '../editing/edit-intent-prompt.js';
import { PROJECT_CONTEXT_SELECTION_SYSTEM_PROMPT } from '../editing/context-selection-prompt.js';
import { PROJECT_EDIT_SYSTEM_PROMPT } from '../editing/edit-prompt.js';
import { PROJECT_REPAIR_SYSTEM_PROMPT } from '../editing/repair-prompt.js';
import { VISUAL_REPAIR_SYSTEM_PROMPT } from '../editing/visual-repair-prompt.js';
import { PROJECT_GENERATION_SYSTEM_PROMPT } from '../generation/prompt.js';
import {
  currentOperationSignal,
  operationCancellationError,
  throwIfOperationCancelled,
} from '../operation-cancellation.js';
import { PLAN_ARTIFACT_SYSTEM_PROMPT } from '../planning/plan-artifact-prompt.js';
import { UI_PLANNER_SYSTEM_PROMPT } from '../planning/ui-planner-prompt.js';
import { BUILD_INTENT_SYSTEM_PROMPT } from '../prompt-intelligence/build-intent-prompt.js';
import { INTENT_ANALYSIS_SYSTEM_PROMPT } from '../prompt-intelligence/intent-prompt.js';
import { SEMANTIC_EXPANSION_SYSTEM_PROMPT } from '../prompt-intelligence/semantic-prompt.js';
import { TASTE_TRANSLATION_SYSTEM_PROMPT } from '../prompt-intelligence/taste-prompt.js';
import type { ModelClient, ModelGeneration } from './model-client.js';

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-v4-pro';
const DEFAULT_REQUEST_TIMEOUT_MS = 600_000;
const DEFAULT_CONTEXT_WINDOW_TOKENS = 128_000;
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
  contextWindowTokens: number;
  maxTokens: number;
  thinkingMode: ThinkingMode;
}

function readPositiveInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const raw = env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

function readThinkingMode(env: NodeJS.ProcessEnv): ThinkingMode {
  const raw = env.DEEPSEEK_THINKING?.trim().toLowerCase();
  if (!raw) {
    return DEFAULT_THINKING_MODE;
  }

  if (raw === 'enabled' || raw === 'disabled') {
    return raw;
  }

  throw new Error('DEEPSEEK_THINKING must be either enabled or disabled.');
}

export function resolveDeepSeekRequestConfig(
  env: NodeJS.ProcessEnv = process.env,
): DeepSeekRequestConfig {
  const contextWindowTokens = readPositiveInteger(
    env,
    'DEEPSEEK_CONTEXT_WINDOW_TOKENS',
    DEFAULT_CONTEXT_WINDOW_TOKENS,
  );
  const maxTokens = readPositiveInteger(env, 'DEEPSEEK_MAX_TOKENS', DEFAULT_MAX_TOKENS);

  if (maxTokens >= contextWindowTokens) {
    throw new Error(
      'DEEPSEEK_MAX_TOKENS must be smaller than DEEPSEEK_CONTEXT_WINDOW_TOKENS.',
    );
  }

  return {
    model: env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL,
    baseUrl: (env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    requestTimeoutMs: readPositiveInteger(
      env,
      'DEEPSEEK_TIMEOUT_MS',
      DEFAULT_REQUEST_TIMEOUT_MS,
    ),
    contextWindowTokens,
    maxTokens,
    thinkingMode: readThinkingMode(env),
  };
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === 'TimeoutError' ||
    /aborted due to timeout|timed out|timeout/i.test(error.message)
  );
}

async function requestStructuredGeneration(
  systemPrompt: string,
  userPrompt: string,
  capabilityLabel: string,
): Promise<DeepSeekGeneration> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is required. Copy .env.example to .env and add your key.');
  }

  throwIfOperationCancelled();
  const config = resolveDeepSeekRequestConfig();
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];
  assertModelRequestWithinBudget({
    messages,
    maxContextTokens: config.contextWindowTokens,
    reservedOutputTokens: config.maxTokens,
    label: `${capabilityLabel} model request`,
  });

  const operationSignal = currentOperationSignal();
  const timeoutSignal = AbortSignal.timeout(config.requestTimeoutMs);
  const requestSignal = operationSignal
    ? AbortSignal.any([operationSignal, timeoutSignal])
    : timeoutSignal;
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
        max_tokens: config.maxTokens,
        stream: false,
      }),
      signal: requestSignal,
    });
  } catch (error) {
    if (operationSignal?.aborted) {
      throw operationCancellationError(operationSignal.reason);
    }
    if (isTimeoutError(error) || timeoutSignal.aborted) {
      const seconds = Math.round(config.requestTimeoutMs / 1000);
      throw new Error(
        `DeepSeek request timed out after ${seconds} seconds during ${capabilityLabel}. ` +
          'Try again, increase DEEPSEEK_TIMEOUT_MS, or keep DEEPSEEK_THINKING=disabled.',
      );
    }

    throw error;
  }

  throwIfOperationCancelled();
  let rawBody: string;
  try {
    rawBody = await response.text();
  } catch (error) {
    if (operationSignal?.aborted) {
      throw operationCancellationError(operationSignal.reason);
    }
    throw error;
  }
  throwIfOperationCancelled();

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

  return { content, model: config.model };
}

export const deepSeekModelClient: ModelClient = {
  id: 'deepseek',
  generateStructured(request) {
    return requestStructuredGeneration(
      request.systemPrompt,
      request.userPrompt,
      request.capabilityLabel,
    );
  },
};

export function requestBuildIntent(userPrompt: string): Promise<DeepSeekGeneration> {
  return deepSeekModelClient.generateStructured({
    systemPrompt: BUILD_INTENT_SYSTEM_PROMPT,
    userPrompt,
    capabilityLabel: 'Build Intent Gate',
  });
}

export function requestPromptIntent(userPrompt: string): Promise<DeepSeekGeneration> {
  return deepSeekModelClient.generateStructured({
    systemPrompt: INTENT_ANALYSIS_SYSTEM_PROMPT,
    userPrompt,
    capabilityLabel: 'Prompt Intelligence Intent Parser',
  });
}

export function requestSemanticExpansion(userPrompt: string): Promise<DeepSeekGeneration> {
  return deepSeekModelClient.generateStructured({
    systemPrompt: SEMANTIC_EXPANSION_SYSTEM_PROMPT,
    userPrompt,
    capabilityLabel: 'Prompt Intelligence Semantic Expander',
  });
}

export function requestTasteTranslation(userPrompt: string): Promise<DeepSeekGeneration> {
  return deepSeekModelClient.generateStructured({
    systemPrompt: TASTE_TRANSLATION_SYSTEM_PROMPT,
    userPrompt,
    capabilityLabel: 'Prompt Intelligence Taste Translator',
  });
}

export function requestProjectCode(userPrompt: string): Promise<DeepSeekGeneration> {
  return deepSeekModelClient.generateStructured({
    systemPrompt: PROJECT_GENERATION_SYSTEM_PROMPT,
    userPrompt,
    capabilityLabel: 'Project Generation',
  });
}

export function requestPlanArtifact(userPrompt: string): Promise<DeepSeekGeneration> {
  return deepSeekModelClient.generateStructured({
    systemPrompt: PLAN_ARTIFACT_SYSTEM_PROMPT,
    userPrompt,
    capabilityLabel: 'Plan Artifact',
  });
}

export function requestUiPlan(userPrompt: string): Promise<DeepSeekGeneration> {
  return deepSeekModelClient.generateStructured({
    systemPrompt: UI_PLANNER_SYSTEM_PROMPT,
    userPrompt,
    capabilityLabel: 'UI Planner',
  });
}

export function requestEditIntentDelta(userPrompt: string): Promise<DeepSeekGeneration> {
  return deepSeekModelClient.generateStructured({
    systemPrompt: EDIT_INTENT_DELTA_SYSTEM_PROMPT,
    userPrompt,
    capabilityLabel: 'Edit Intent Delta',
  });
}

export function requestDesignCritique(userPrompt: string): Promise<DeepSeekGeneration> {
  return deepSeekModelClient.generateStructured({
    systemPrompt: DESIGN_CRITIC_SYSTEM_PROMPT,
    userPrompt,
    capabilityLabel: 'Design Critic',
  });
}

export function requestProjectContextSelection(userPrompt: string): Promise<DeepSeekGeneration> {
  return deepSeekModelClient.generateStructured({
    systemPrompt: PROJECT_CONTEXT_SELECTION_SYSTEM_PROMPT,
    userPrompt,
    capabilityLabel: 'Project Context Selection',
  });
}

export function requestProjectPatch(editContext: string): Promise<DeepSeekGeneration> {
  return deepSeekModelClient.generateStructured({
    systemPrompt: PROJECT_EDIT_SYSTEM_PROMPT,
    userPrompt: editContext,
    capabilityLabel: 'Project Edit',
  });
}

export function requestProjectRepair(repairContext: string): Promise<DeepSeekGeneration> {
  return deepSeekModelClient.generateStructured({
    systemPrompt: PROJECT_REPAIR_SYSTEM_PROMPT,
    userPrompt: repairContext,
    capabilityLabel: 'One-shot Project Repair',
  });
}

export function requestVisualRepair(userPrompt: string): Promise<DeepSeekGeneration> {
  return deepSeekModelClient.generateStructured({
    systemPrompt: VISUAL_REPAIR_SYSTEM_PROMPT,
    userPrompt,
    capabilityLabel: 'Visual Repair',
  });
}
