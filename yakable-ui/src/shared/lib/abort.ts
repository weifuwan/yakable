export function abortError(signal?: AbortSignal): Error {
  const reason = signal?.reason;
  if (reason instanceof Error) return reason;
  const error = new Error(
    typeof reason === 'string' && reason.trim() ? reason : 'Stopped by user.',
  );
  error.name = 'AbortError';
  return error;
}

export function isAbortLike(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return error instanceof Error
    && (error.name === 'AbortError' || error.name === 'OperationCancelledError');
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError(signal);
}

export function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  throwIfAborted(signal);

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const onAbort = () => settle(() => reject(abortError(signal)));

    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      value => settle(() => resolve(value)),
      error => settle(() => reject(error)),
    );
  });
}

export function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise(resolve => window.setTimeout(resolve, ms));
}
