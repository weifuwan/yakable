import {
  assertWithinContextBudget,
  createContextBudget,
  type ContextBudget,
  type ContextBudgetUsage,
} from './context-budget.js';
import { estimateTextTokens } from './token-estimator.js';

export const MODEL_REQUEST_MESSAGE_OVERHEAD_TOKENS = 4;
export const MODEL_REQUEST_REPLY_PRIMING_TOKENS = 3;

export type ModelRequestMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ModelRequestBudgetMessage {
  readonly role: ModelRequestMessageRole;
  readonly content: string;
}

export interface ModelRequestBudgetInput {
  readonly messages: readonly ModelRequestBudgetMessage[];
  readonly maxContextTokens: number;
  readonly reservedOutputTokens: number;
  readonly label?: string;
}

export interface ModelRequestBudgetResult {
  readonly budget: ContextBudget;
  readonly usage: ContextBudgetUsage;
  readonly estimatedMessageTokens: number;
  readonly messageCount: number;
}

function estimateMessageTokens(message: ModelRequestBudgetMessage): number {
  return (
    MODEL_REQUEST_MESSAGE_OVERHEAD_TOKENS
    + estimateTextTokens(message.role)
    + estimateTextTokens(message.content)
  );
}

/**
 * Estimate the complete model-visible chat input, including every system,
 * user, assistant, and tool message supplied to one request.
 *
 * This remains a conservative Yakable-side estimate rather than a claim about
 * one provider's exact chat-template tokenizer. The fixed message/priming
 * overheads keep the estimate from counting message content alone.
 */
export function estimateModelRequestTokens(
  messages: readonly ModelRequestBudgetMessage[],
): number {
  return messages.reduce(
    (total, message) => total + estimateMessageTokens(message),
    MODEL_REQUEST_REPLY_PRIMING_TOKENS,
  );
}

/**
 * Final safety gate immediately before a model request is sent.
 *
 * Local Context providers may have their own sub-budgets, but this check owns
 * the end-to-end invariant: all model-visible input plus reserved output must
 * fit inside the configured request envelope.
 */
export function assertModelRequestWithinBudget(
  input: ModelRequestBudgetInput,
): ModelRequestBudgetResult {
  const budget = createContextBudget({
    maxContextTokens: input.maxContextTokens,
    reservedOutputTokens: input.reservedOutputTokens,
  });
  const estimatedMessageTokens = estimateModelRequestTokens(input.messages);
  const usage = assertWithinContextBudget(
    budget,
    estimatedMessageTokens,
    input.label ?? 'Model request',
  );

  return {
    budget,
    usage,
    estimatedMessageTokens,
    messageCount: input.messages.length,
  };
}
