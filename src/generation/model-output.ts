export class ModelOutputFormatError extends Error {
  readonly code = 'MODEL_OUTPUT_INVALID_JSON';

  constructor(message = 'Model output was not valid JSON.') {
    super(message);
    this.name = 'ModelOutputFormatError';
  }
}

function isJsonObject(candidate: string): boolean {
  try {
    const value: unknown = JSON.parse(candidate);
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}

function fencedBody(value: string): string | null {
  const match = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() || null;
}

function balancedJsonObject(value: string): string | null {
  for (let start = value.indexOf('{'); start !== -1; start = value.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < value.length; index += 1) {
      const character = value[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (character === '\\') {
          escaped = true;
          continue;
        }
        if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }
      if (character === '{') {
        depth += 1;
        continue;
      }
      if (character !== '}') {
        continue;
      }

      depth -= 1;
      if (depth !== 0) {
        continue;
      }

      const candidate = value.slice(start, index + 1).trim();
      if (isJsonObject(candidate)) {
        return candidate;
      }
      break;
    }
  }

  return null;
}

export function normalizeModelJsonObject(rawContent: string): string {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    throw new ModelOutputFormatError('Model output was empty.');
  }

  if (isJsonObject(trimmed)) {
    return trimmed;
  }

  const fenced = fencedBody(trimmed);
  if (fenced && isJsonObject(fenced)) {
    return fenced;
  }

  const extracted = balancedJsonObject(trimmed);
  if (extracted) {
    return extracted;
  }

  throw new ModelOutputFormatError();
}
