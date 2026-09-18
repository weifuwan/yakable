import { requestBuildIntent } from '../model/deepseek.js';
import type {
  BuildIntentConfidence,
  BuildIntentDecision,
  BuildIntentRoute,
} from '../types.js';

const MAX_PROMPT_LENGTH = 12_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRoute(value: unknown): BuildIntentRoute {
  if (value === 'CREATE' || value === 'CHAT' || value === 'CLARIFY') return value;
  throw new Error('Build Intent Gate returned an invalid route.');
}

function readConfidence(value: unknown): BuildIntentConfidence {
  if (value === 'high' || value === 'medium') return value;
  throw new Error('Build Intent Gate returned an invalid confidence.');
}

function readMessage(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Build Intent Gate returned an invalid message.');
  }
  return value.trim().slice(0, 600);
}

function usesChinese(value: string): boolean {
  return /[\u3400-\u9fff]/u.test(value);
}

export function detectObviousBuildIntent(prompt: string): BuildIntentDecision | null {
  const normalized = prompt.trim();
  const lower = normalized.toLowerCase();

  const greetings = new Set([
    'hi',
    'hello',
    'hey',
    'yo',
    '你好',
    '您好',
    '嗨',
    '哈喽',
    '哈啰',
  ]);
  const greetingKey = lower.replace(/[!！,.，。?？\s]+$/u, '').trim();
  if (greetings.has(greetingKey)) {
    return {
      version: 1,
      route: 'CHAT',
      confidence: 'high',
      message: usesChinese(normalized)
        ? '你好！告诉我你想做什么前端页面、网站或应用，我再开始创建项目。'
        : "Hi! Tell me what frontend page, website, or app you'd like to build, and I'll start a project.",
    };
  }

  if (/^hello\s+(?:world|word)[!！,.，。?？\s]*$/i.test(normalized)) {
    return {
      version: 1,
      route: 'CLARIFY',
      confidence: 'high',
      message:
        'Do you want me to create a Hello World page? If yes, try: “Create a Hello World page.”',
    };
  }

  return null;
}

export function parseBuildIntentDecision(raw: string): BuildIntentDecision {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Build Intent Gate returned invalid JSON.');
  }

  if (!isRecord(parsed) || parsed.version !== 1) {
    throw new Error('Build Intent Gate returned an unsupported decision version.');
  }

  return {
    version: 1,
    route: readRoute(parsed.route),
    confidence: readConfidence(parsed.confidence),
    message: readMessage(parsed.message),
  };
}

export async function classifyBuildIntent(prompt: string): Promise<BuildIntentDecision> {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    throw new Error('A prompt is required for Build Intent Gate.');
  }
  if (normalizedPrompt.length > MAX_PROMPT_LENGTH) {
    throw new Error('Prompt is too long. Build Intent Gate accepts at most 12,000 characters.');
  }

  const obvious = detectObviousBuildIntent(normalizedPrompt);
  if (obvious) return obvious;

  const generation = await requestBuildIntent(
    JSON.stringify({ userInput: normalizedPrompt }, null, 2),
  );
  return parseBuildIntentDecision(generation.content);
}

export class BuildIntentGateError extends Error {
  readonly decision: BuildIntentDecision;

  constructor(decision: BuildIntentDecision) {
    super(decision.message);
    this.name = 'BuildIntentGateError';
    this.decision = decision;
  }
}
