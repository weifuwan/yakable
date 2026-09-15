export interface ContextBudgetInput {
  readonly maxContextTokens: number;
  readonly reservedOutputTokens: number;
}

export interface ContextBudget extends ContextBudgetInput {
  readonly maxInputTokens: number;
}

export interface ContextBudgetUsage {
  readonly estimatedInputTokens: number;
  readonly remainingInputTokens: number;
  readonly utilization: number;
  readonly overBudget: boolean;
}

function requirePositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer.`);
  }
  return value;
}

function requireNonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer.`);
  }
  return value;
}

export function createContextBudget(input: ContextBudgetInput): ContextBudget {
  const maxContextTokens = requirePositiveInteger(input.maxContextTokens, 'maxContextTokens');
  const reservedOutputTokens = requireNonNegativeInteger(
    input.reservedOutputTokens,
    'reservedOutputTokens',
  );

  if (reservedOutputTokens >= maxContextTokens) {
    throw new Error('reservedOutputTokens must be smaller than maxContextTokens.');
  }

  return {
    maxContextTokens,
    reservedOutputTokens,
    maxInputTokens: maxContextTokens - reservedOutputTokens,
  };
}

export function measureContextBudget(
  budget: ContextBudget,
  estimatedInputTokens: number,
): ContextBudgetUsage {
  const estimated = requireNonNegativeInteger(estimatedInputTokens, 'estimatedInputTokens');
  const remainingInputTokens = Math.max(0, budget.maxInputTokens - estimated);

  return {
    estimatedInputTokens: estimated,
    remainingInputTokens,
    utilization: budget.maxInputTokens === 0 ? 1 : estimated / budget.maxInputTokens,
    overBudget: estimated > budget.maxInputTokens,
  };
}

export function assertWithinContextBudget(
  budget: ContextBudget,
  estimatedInputTokens: number,
  label = 'Context input',
): ContextBudgetUsage {
  const usage = measureContextBudget(budget, estimatedInputTokens);
  if (usage.overBudget) {
    throw new Error(
      `${label} exceeds its Context budget (${usage.estimatedInputTokens} estimated tokens; max ${budget.maxInputTokens}).`,
    );
  }
  return usage;
}
