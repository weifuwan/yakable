import { requestSemanticExpansion } from '../model/deepseek.js';
import type {
  PromptIntent,
  SemanticDefault,
  SemanticDefaultBasis,
  SemanticDefaultKind,
  SemanticExpansion,
  SemanticConfidence,
} from '../types.js';

const MAX_PROMPT_LENGTH = 12_000;
const MAX_DEFAULTS = 16;
const MAX_ASSUMPTIONS = 6;
const MAX_DEFERRED_DECISIONS = 10;

const DEFAULT_KINDS = new Set<SemanticDefaultKind>([
  'structure',
  'content',
  'capability',
  'behavior',
  'quality',
]);
const DEFAULT_BASES = new Set<SemanticDefaultBasis>([
  'product-pattern',
  'page-pattern',
  'goal-pattern',
  'universal',
]);
const CONFIDENCE_LEVELS = new Set<SemanticConfidence>(['high', 'medium']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: Set<T>,
): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    throw new Error(`Semantic Expander returned an invalid ${field}.`);
  }
  return value as T;
}

function readStringArray(value: unknown, field: string, maxItems: number): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Semantic Expander returned an invalid ${field}.`);
  }

  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new Error(`Semantic Expander returned a non-string item in ${field}.`);
    }
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    items.push(normalized);
    if (items.length >= maxItems) {
      break;
    }
  }
  return items;
}

function readDefaults(value: unknown): SemanticDefault[] {
  if (!Array.isArray(value)) {
    throw new Error('Semantic Expander returned an invalid defaults array.');
  }

  const defaults: SemanticDefault[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!isRecord(item)) {
      throw new Error('Semantic Expander returned an invalid default item.');
    }

    const kind = readEnum(item.kind, 'default kind', DEFAULT_KINDS);
    if (typeof item.value !== 'string' || !item.value.trim()) {
      throw new Error('Semantic Expander returned an invalid default value.');
    }
    const normalizedValue = item.value.trim();
    const key = `${kind}:${normalizedValue.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    defaults.push({
      kind,
      value: normalizedValue,
      basis: readEnum(item.basis, 'default basis', DEFAULT_BASES),
      confidence: readEnum(item.confidence, 'default confidence', CONFIDENCE_LEVELS),
    });

    if (defaults.length >= MAX_DEFAULTS) {
      break;
    }
  }

  return defaults;
}

export function parseSemanticExpansion(raw: string): SemanticExpansion {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Semantic Expander returned invalid JSON.');
  }

  if (!isRecord(parsed)) {
    throw new Error('Semantic Expander must return a JSON object.');
  }
  if (parsed.version !== 1) {
    throw new Error('Semantic Expander returned an unsupported expansion version.');
  }

  return {
    version: 1,
    defaults: readDefaults(parsed.defaults),
    assumptions: readStringArray(parsed.assumptions, 'assumptions', MAX_ASSUMPTIONS),
    deferredDecisions: readStringArray(
      parsed.deferredDecisions,
      'deferredDecisions',
      MAX_DEFERRED_DECISIONS,
    ),
  };
}

export function buildSemanticExpansionRequest(
  productRequest: string,
  promptIntent: PromptIntent,
): string {
  return JSON.stringify(
    {
      productRequest,
      promptIntent,
    },
    null,
    2,
  );
}

export async function expandPromptSemantics(
  prompt: string,
  intent: PromptIntent,
): Promise<SemanticExpansion> {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    throw new Error('A product prompt is required.');
  }
  if (normalizedPrompt.length > MAX_PROMPT_LENGTH) {
    throw new Error('Prompt is too long. Semantic Expander accepts at most 12,000 characters.');
  }

  const generation = await requestSemanticExpansion(
    buildSemanticExpansionRequest(normalizedPrompt, intent),
  );
  return parseSemanticExpansion(generation.content);
}
