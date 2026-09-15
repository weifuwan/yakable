import { requestTasteTranslation } from '../model/capabilities.js';
import { defaultModelClient } from '../model/default-client.js';
import type { ModelClient } from '../model/model-client.js';
import type {
  PromptIntent,
  SemanticExpansion,
  TasteDecision,
  TasteDecisionArea,
  TasteDecisionBasis,
  TasteIntensity,
  TasteTranslation,
} from '../types.js';

const MAX_PROMPT_LENGTH = 12_000;
const MAX_DECISIONS = 20;
const MAX_SOURCE_KEYWORDS = 8;
const MAX_ANTI_PATTERNS = 12;
const MAX_UNRESOLVED_DECISIONS = 8;

const DECISION_AREAS = new Set<TasteDecisionArea>([
  'visual-hierarchy', 'composition', 'typography', 'color', 'spacing-density',
  'surface-treatment', 'imagery', 'motion', 'component-expression',
]);
const DECISION_BASES = new Set<TasteDecisionBasis>([
  'style-keyword', 'product-context', 'page-context', 'audience-context',
  'explicit-requirement', 'hard-constraint',
]);
const INTENSITY_LEVELS = new Set<TasteIntensity>(['strong', 'moderate', 'subtle']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readEnum<T extends string>(value: unknown, field: string, allowed: Set<T>): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    throw new Error(`Taste Translator returned an invalid ${field}.`);
  }
  return value as T;
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Taste Translator returned an invalid ${field}.`);
  }
  return value.trim();
}

function readStringArray(value: unknown, field: string, maxItems: number): string[] {
  if (!Array.isArray(value)) throw new Error(`Taste Translator returned an invalid ${field}.`);
  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new Error(`Taste Translator returned a non-string item in ${field}.`);
    }
    const normalized = item.trim();
    const key = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    items.push(normalized);
    if (items.length >= maxItems) break;
  }
  return items;
}

function readDecisions(value: unknown): TasteDecision[] {
  if (!Array.isArray(value)) throw new Error('Taste Translator returned an invalid decisions array.');
  const decisions: TasteDecision[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) throw new Error('Taste Translator returned an invalid decision item.');
    const area = readEnum(item.area, 'decision area', DECISION_AREAS);
    const directive = readRequiredString(item.directive, 'decision directive');
    const key = `${area}:${directive.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    decisions.push({
      area,
      directive,
      basis: readEnum(item.basis, 'decision basis', DECISION_BASES),
      intensity: readEnum(item.intensity, 'decision intensity', INTENSITY_LEVELS),
      sourceKeywords: readStringArray(item.sourceKeywords, 'decision sourceKeywords', MAX_SOURCE_KEYWORDS),
    });
    if (decisions.length >= MAX_DECISIONS) break;
  }
  return decisions;
}

export function parseTasteTranslation(raw: string): TasteTranslation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Taste Translator returned invalid JSON.');
  }
  if (!isRecord(parsed)) throw new Error('Taste Translator must return a JSON object.');
  if (parsed.version !== 1) throw new Error('Taste Translator returned an unsupported translation version.');

  return {
    version: 1,
    designDirection: readRequiredString(parsed.designDirection, 'designDirection'),
    decisions: readDecisions(parsed.decisions),
    antiPatterns: readStringArray(parsed.antiPatterns, 'antiPatterns', MAX_ANTI_PATTERNS),
    unresolvedDecisions: readStringArray(parsed.unresolvedDecisions, 'unresolvedDecisions', MAX_UNRESOLVED_DECISIONS),
  };
}

export function buildTasteTranslationRequest(
  productRequest: string,
  promptIntent: PromptIntent,
  semanticExpansion: SemanticExpansion,
): string {
  return JSON.stringify({ productRequest, promptIntent, semanticExpansion }, null, 2);
}

export async function translatePromptTaste(
  prompt: string,
  intent: PromptIntent,
  semanticExpansion: SemanticExpansion,
  modelClient: ModelClient = defaultModelClient,
): Promise<TasteTranslation> {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) throw new Error('A product prompt is required.');
  if (normalizedPrompt.length > MAX_PROMPT_LENGTH) {
    throw new Error('Prompt is too long. Taste Translator accepts at most 12,000 characters.');
  }

  const generation = await requestTasteTranslation(
    modelClient,
    buildTasteTranslationRequest(normalizedPrompt, intent, semanticExpansion),
  );
  return parseTasteTranslation(generation.content);
}
