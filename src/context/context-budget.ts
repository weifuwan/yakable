export interface ContextBudgetInput {
  maxContextTokens: number;
  reservedOutputTokens: number;
}

export interface ContextBudget extends ContextBudgetInput {
  maxInputTokens: number;
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
