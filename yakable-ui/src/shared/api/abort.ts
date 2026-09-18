export function abortError(signal?: AbortSignal | null): Error {
  const reason = signal?.reason;
  if (reason instanceof Error) return reason;

  const error = new Error(
    typeof reason === 'string' && reason.trim() ? reason : 'The request was aborted.',
  );
  error.name = 'AbortError';
  return error;
}

export function isAbortError(
  error: unknown,
  signal?: AbortSignal | null,
): boolean {
  if (signal?.aborted) return true;
  return error instanceof Error && error.name === 'AbortError';
}

export function throwIfAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) throw abortError(signal);
}
