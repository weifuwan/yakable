import { generateProjectChatReply } from '../conversation/project-chat.js';
import { requestProjectMessageDecision } from '../model/capabilities.js';
import { defaultModelClient } from '../model/default-client.js';
import type { ModelClient } from '../model/model-client.js';
import type { ProjectConversationMessage } from '../types.js';

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

const MAX_USER_INPUT = 8_000;
const MAX_RECENT_MESSAGES = 10;
const MAX_RECENT_MESSAGE_LENGTH = 1_500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRoute(value: unknown): ProjectMessageRoute {
  if (value === 'CHAT' || value === 'CLARIFY' || value === 'BUILD' || value === 'EDIT') return value;
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

function fastChatDecision(message: string): ProjectMessageDecision {
  return { version: 1, route: 'CHAT', confidence: 'high', message };
}

export function detectObviousProjectMessageIntent(
  input: Pick<ProjectMessageIntentInput, 'userInput'>,
): ProjectMessageDecision | null {
  const normalized = input.userInput.trim();
  const compact = normalized.toLowerCase().replace(/[!！,.，。?？~～\s]+$/u, '').trim();

  const acknowledgements = new Set([
    'good', 'great', 'nice', 'cool', 'ok', 'okay', 'thanks', 'thank you', 'got it',
    '好的', '好', '可以', '行', '不错', '很好', '明白了', '知道了', '谢谢',
  ]);
  if (acknowledgements.has(compact)) return fastChatDecision('Acknowledgement; no UI change requested.');

  const greetings = new Set(['hi', 'hello', 'hey', '你好', '您好', '嗨', '哈喽']);
  if (greetings.has(compact)) return fastChatDecision('Greeting; no UI change requested.');

  const identityQuestions = new Set(['who are you', 'what are you', '你是谁', '你是誰', '你是什么', '你是什麼']);
  if (identityQuestions.has(compact)) return fastChatDecision('Identity question; no UI change requested.');
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

export async function classifyProjectMessageIntent(
  input: ProjectMessageIntentInput,
  modelClient: ModelClient = defaultModelClient,
): Promise<ProjectMessageDecision> {
  const normalized = normalizedInput(input);
  const obvious = detectObviousProjectMessageIntent(normalized);
  const routed = obvious ?? parseProjectMessageDecision((await requestProjectMessageDecision(
    modelClient,
    JSON.stringify(normalized, null, 2),
  )).content);

  if (routed.route === 'CHAT' || routed.route === 'CLARIFY') {
    const reply = await generateProjectChatReply({
      mode: routed.route,
      userInput: normalized.userInput,
      hasGeneratedUi: normalized.hasGeneratedUi,
      recentConversation: normalized.recentConversation,
    }, modelClient);
    return { ...routed, message: reply.message };
  }

  return routed;
}
