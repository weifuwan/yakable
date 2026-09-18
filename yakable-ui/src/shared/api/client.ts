import { isAbortError } from './abort';
import { ApiError, createHttpError } from './error';

export interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  body?: BodyInit | null;
  json?: unknown;
}

function mergeHeaders(
  headers: HeadersInit | undefined,
  defaults: Record<string, string>,
): Headers {
  const result = new Headers(headers);

  for (const [name, value] of Object.entries(defaults)) {
    if (!result.has(name)) result.set(name, value);
  }

  return result;
}

export async function request(
  input: RequestInfo | URL,
  init: ApiRequestInit = {},
): Promise<Response> {
  const { json, body, headers, signal, ...requestInit } = init;

  if (json !== undefined && body !== undefined && body !== null) {
    throw new Error('API request cannot define both body and json.');
  }

  const requestHeaders = mergeHeaders(headers, {});
  const requestBody =
    json === undefined
      ? body
      : JSON.stringify(json);

  if (json !== undefined && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(input, {
      ...requestInit,
      headers: requestHeaders,
      body: requestBody,
      signal,
    });
  } catch (error) {
    if (isAbortError(error, signal)) throw error;
    throw new ApiError('Network request failed.', {
      kind: 'network',
      cause: error,
    });
  }

  if (!response.ok) {
    throw await createHttpError(response);
  }

  return response;
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  init: ApiRequestInit = {},
): Promise<T> {
  const headers = mergeHeaders(init.headers, {
    Accept: 'application/json',
  });
  const response = await request(input, { ...init, headers });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new ApiError('Response body is not valid JSON.', {
      kind: 'parse',
      status: response.status,
      data: text,
      cause: error,
    });
  }
}
