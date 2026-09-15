import { requestPromptIntent } from '../model/capabilities.js';
import { defaultModelClient } from '../model/default-client.js';
import type { ModelClient } from '../model/model-client.js';
import type { PromptIntent } from '../types.js';

const MAX_PROMPT_LENGTH = 12_000;
const MAX_INTENT_ITEMS = 24;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredString(
  value: unknown,
  field: keyof Pick<PromptIntent, 'productType' | 'pageType' | 'primaryGoal'>,
): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Intent Parser returned an invalid ${field}.`);
  }
  return value.trim();
}

function readOptionalString(value: unknown, field: 'targetAudience'): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new Error(`Intent Parser returned an invalid ${field}.`);
  }
  const normalized = value.trim();
  return normalized || null;
}

function readStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`Intent Parser returned an invalid ${field}.`);

  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new Error(`Intent Parser returned a non-string item in ${field}.`);
    }
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    items.push(normalized);
    if (items.length >= MAX_INTENT_ITEMS) break;
  }
  return items;
}

export function parsePromptIntent(raw: string): PromptIntent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Intent Parser returned invalid JSON.');
  }

  if (!isRecord(parsed)) throw new Error('Intent Parser must return a JSON object.');
  if (parsed.version !== 1) throw new Error('Intent Parser returned an unsupported intent version.');

  return {
    version: 1,
    productType: readRequiredString(parsed.productType, 'productType'),
    pageType: readRequiredString(parsed.pageType, 'pageType'),
    primaryGoal: readRequiredString(parsed.primaryGoal, 'primaryGoal'),
    targetAudience: readOptionalString(parsed.targetAudience, 'targetAudience'),
    styleKeywords: readStringArray(parsed.styleKeywords, 'styleKeywords'),
    explicitRequirements: readStringArray(parsed.explicitRequirements, 'explicitRequirements'),
    hardConstraints: readStringArray(parsed.hardConstraints, 'hardConstraints'),
    missingInformation: readStringArray(parsed.missingInformation, 'missingInformation'),
  };
}

export async function analyzePromptIntent(
  prompt: string,
  modelClient: ModelClient = defaultModelClient,
): Promise<PromptIntent> {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) throw new Error('A product prompt is required.');
  if (normalizedPrompt.length > MAX_PROMPT_LENGTH) {
    throw new Error('Prompt is too long. Intent Parser accepts at most 12,000 characters.');
  }

  const generation = await requestPromptIntent(
    modelClient,
    JSON.stringify({ productRequest: normalizedPrompt }, null, 2),
  );
  return parsePromptIntent(generation.content);
}
