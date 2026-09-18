import { throwIfAborted } from './abort';
import { request, type ApiRequestInit } from './client';
import { ApiError } from './error';

export type NdjsonParser<T> = (line: string) => T;

export function parseJsonLine<T = unknown>(line: string): T {
  try {
    return JSON.parse(line) as T;
  } catch (error) {
    throw new ApiError('Stream returned invalid JSON.', {
      kind: 'parse',
      data: line,
      cause: error,
    });
  }
}

export async function* readNdjson<T>(
  response: Response,
  parse: NdjsonParser<T>,
  signal?: AbortSignal | null,
): AsyncGenerator<T> {
  throwIfAborted(signal);

  if (!response.body) {
    throw new ApiError('Response body is not available as a stream.', {
      kind: 'parse',
      status: response.status,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      throwIfAborted(signal);
      const chunk = await reader.read();
      throwIfAborted(signal);

      buffer += decoder.decode(chunk.value ?? new Uint8Array(), {
        stream: !chunk.done,
      });

      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);

        if (line) yield parse(line);
        newline = buffer.indexOf('\n');
      }

      if (chunk.done) break;
    }

    const trailingLine = buffer.trim();
    if (trailingLine) yield parse(trailingLine);
  } finally {
    reader.releaseLock();
  }
}

export async function* requestNdjson<T>(
  input: RequestInfo | URL,
  parse: NdjsonParser<T>,
  init: ApiRequestInit = {},
): AsyncGenerator<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/x-ndjson');
  }

  const response = await request(input, { ...init, headers });
  yield* readNdjson(response, parse, init.signal);
}
