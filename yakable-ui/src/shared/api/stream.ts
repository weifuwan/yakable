import { throwIfAborted } from '@/shared/lib/abort';

export function parseRecord(line: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(line);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('Agent stream returned an invalid record.');
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Agent stream returned invalid JSON.');
    }
    throw error;
  }
}

export async function consumeNdjson<T>(
  response: Response,
  consumeLine: (line: string) => void,
  getResult: () => T | null,
  signal?: AbortSignal,
): Promise<T> {
  throwIfAborted(signal);

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || `Yakable API failed with HTTP ${response.status}.`);
  }
  if (!response.body) {
    throw new Error('Agent stream is not available in this browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    throwIfAborted(signal);
    const chunk = await reader.read();
    throwIfAborted(signal);
    buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });

    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (line.trim()) consumeLine(line);
      newline = buffer.indexOf('\n');
    }
    if (chunk.done) break;
  }

  if (buffer.trim()) consumeLine(buffer);
  throwIfAborted(signal);

  const result = getResult();
  if (!result) throw new Error('Agent stream ended without a result.');
  return result;
}
