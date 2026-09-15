export const CONTEXT_TOKEN_ESTIMATOR_VERSION = 1 as const;

export interface TruncatedTextResult {
  text: string;
  estimatedTokens: number;
  truncated: boolean;
}

function requireNonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer.`);
  }
  return value;
}

function isCjkLike(codePoint: number): boolean {
  return (
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0x3040 && codePoint <= 0x30ff) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7af)
  );
}

/**
 * Conservative dependency-free token estimate for Context budgeting.
 *
 * This is intentionally not a provider tokenizer. ASCII text is estimated at
 * roughly four characters per token, CJK-like text at one code point per token,
 * and other Unicode text at two code points per token. Provider-specific
 * tokenizers can replace this implementation behind the same Context boundary.
 */
export function estimateTextTokens(value: string): number {
  if (!value) return 0;

  let ascii = 0;
  let cjkLike = 0;
  let other = 0;

  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (isCjkLike(codePoint)) cjkLike += 1;
    else if (codePoint <= 0x7f) ascii += 1;
    else other += 1;
  }

  return Math.ceil(ascii / 4) + cjkLike + Math.ceil(other / 2);
}

export function truncateTextToEstimatedTokens(
  value: string,
  maxTokens: number,
): TruncatedTextResult {
  const limit = requireNonNegativeInteger(maxTokens, 'maxTokens');
  const normalized = value.trim();
  const originalTokens = estimateTextTokens(normalized);

  if (originalTokens <= limit) {
    return {
      text: normalized,
      estimatedTokens: originalTokens,
      truncated: false,
    };
  }

  if (limit === 0 || !normalized) {
    return { text: '', estimatedTokens: 0, truncated: Boolean(normalized) };
  }

  const characters = Array.from(normalized);
  let low = 0;
  let high = characters.length;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = characters.slice(0, middle).join('').trimEnd();
    if (estimateTextTokens(candidate) <= limit) low = middle;
    else high = middle - 1;
  }

  const text = characters.slice(0, low).join('').trimEnd();
  return {
    text,
    estimatedTokens: estimateTextTokens(text),
    truncated: true,
  };
}
