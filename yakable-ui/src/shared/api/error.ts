export type ApiErrorKind = 'http' | 'network' | 'parse';

export interface ApiErrorOptions {
  kind: ApiErrorKind;
  status?: number;
  code?: string;
  data?: unknown;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly data?: unknown;

  constructor(message: string, options: ApiErrorOptions) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ApiError';
    this.kind = options.kind;
    this.status = options.status;
    this.code = options.code;
    this.data = options.data;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function field(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' && candidate.trim()
    ? candidate
    : undefined;
}

async function readErrorData(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function createHttpError(response: Response): Promise<ApiError> {
  const data = await readErrorData(response);
  const message =
    field(data, 'message')
    ?? field(data, 'error')
    ?? response.statusText
    ?? `Request failed with HTTP ${response.status}.`;

  return new ApiError(message || `Request failed with HTTP ${response.status}.`, {
    kind: 'http',
    status: response.status,
    code: field(data, 'code'),
    data,
  });
}
