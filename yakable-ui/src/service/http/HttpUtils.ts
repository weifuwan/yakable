export type ApiErrorKind = 'http' | 'network' | 'parse' | 'business';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: number;
  readonly data?: unknown;

  constructor(
    message: string,
    options: {
      kind: ApiErrorKind;
      status?: number;
      code?: number;
      data?: unknown;
      cause?: unknown;
    },
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ApiError';
    this.kind = options.kind;
    this.status = options.status;
    this.code = options.code;
    this.data = options.data;
  }
}

export interface HttpOptions {
  signal?: AbortSignal;
}

export interface SseEvent {
  event: string;
  data: unknown;
}

interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'X-XSRF-TOKEN';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

function readCookie(name: string) {
  if (typeof document === 'undefined') return null;

  const prefix = name + '=';
  const value = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}

function csrfHeaders(method: string | undefined): Record<string, string> {
  if (SAFE_METHODS.has((method ?? 'GET').toUpperCase())) return {};

  const token = readCookie(CSRF_COOKIE);
  return token ? { [CSRF_HEADER]: token } : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isApiResult(value: unknown): value is ApiResult<unknown> {
  return (
    isRecord(value) &&
    typeof value.code === 'number' &&
    typeof value.message === 'string' &&
    'data' in value
  );
}

function parseJson(text: string, message: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new ApiError(message, { kind: 'parse', cause: error });
  }
}

function parseSseBlock(block: string): SseEvent | null {
  let event = 'message';
  const data: string[] = [];

  for (const line of block.split('\n')) {
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data.push(line.slice(5).trimStart());
    }
  }

  if (data.length === 0) return null;
  const raw = data.join('\n');
  return {
    event,
    data: raw ? parseJson(raw, 'SSE event returned invalid JSON.') : null,
  };
}

async function readText(response: Response) {
  try {
    return await response.text();
  } catch (error) {
    throw new ApiError('Unable to read response.', {
      kind: 'network',
      status: response.status,
      cause: error,
    });
  }
}

async function toHttpError(response: Response) {
  const text = await readText(response);
  const payload = text.trim() ? parseJson(text, 'HTTP error returned invalid JSON.') : undefined;

  if (isApiResult(payload)) {
    return new ApiError(payload.message || 'Request failed.', {
      kind: 'http',
      status: response.status,
      code: payload.code,
      data: payload.data,
    });
  }

  return new ApiError(response.statusText || 'Request failed with HTTP ' + response.status + '.', {
    kind: 'http',
    status: response.status,
    data: payload,
  });
}

async function parseResult<T>(response: Response): Promise<T> {
  const text = await readText(response);
  const payload = parseJson(text, 'API returned invalid JSON.');

  if (!isApiResult(payload)) {
    throw new ApiError('API returned an invalid response.', {
      kind: 'parse',
      status: response.status,
      data: payload,
    });
  }

  if (payload.code !== 0) {
    throw new ApiError(payload.message || 'Request failed.', {
      kind: 'business',
      status: response.status,
      code: payload.code,
      data: payload.data,
    });
  }

  return payload.data as T;
}

async function requireOk(response: Response) {
  if (response.ok) return;

  const error = await toHttpError(response);
  if (response.status === 401) {
    unauthorizedHandler?.();
  }
  throw error;
}

/**
 * 前端统一 HTTP 入口。
 */
export class HttpUtils {
  static get<T>(url: string, options: HttpOptions = {}) {
    return HttpUtils.request<T>(url, {
      method: 'GET',
      signal: options.signal,
    });
  }

  static post<T>(url: string, body: unknown, options: HttpOptions = {}) {
    return HttpUtils.request<T>(url, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: options.signal,
    });
  }

  static put<T>(url: string, body: unknown, options: HttpOptions = {}) {
    return HttpUtils.request<T>(url, {
      method: 'PUT',
      body: JSON.stringify(body),
      signal: options.signal,
    });
  }

  static async postSse(
    url: string,
    body: unknown,
    onEvent: (event: SseEvent) => void,
    options: HttpOptions = {},
  ) {
    await HttpUtils.ensureCsrfToken('POST', options.signal);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
          ...csrfHeaders('POST'),
        },
        body: JSON.stringify(body),
        signal: options.signal,
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new ApiError('Unable to connect to server.', {
        kind: 'network',
        cause: error,
      });
    }

    await requireOk(response);
    if (!response.body) {
      throw new ApiError('Streaming response body is unavailable.', {
        kind: 'parse',
        status: response.status,
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');

      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');

        const event = parseSseBlock(block);
        if (event) onEvent(event);
      }

      if (done) break;
    }
  }

  private static async request<T>(url: string, init: RequestInit): Promise<T> {
    await HttpUtils.ensureCsrfToken(init.method, init.signal);

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...csrfHeaders(init.method),
        },
      });
    } catch (error) {
      if (init.signal?.aborted) throw error;
      throw new ApiError('Unable to connect to server.', {
        kind: 'network',
        cause: error,
      });
    }

    await requireOk(response);
    return parseResult<T>(response);
  }

  private static async ensureCsrfToken(method: string | undefined, signal?: AbortSignal | null) {
    if (SAFE_METHODS.has((method ?? 'GET').toUpperCase()) || readCookie(CSRF_COOKIE)) {
      return;
    }

    await HttpUtils.get<unknown>('/api/auth/csrf', {
      signal: signal ?? undefined,
    });

    if (!readCookie(CSRF_COOKIE)) {
      throw new ApiError('CSRF token cookie is unavailable.', {
        kind: 'network',
      });
    }
  }
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
