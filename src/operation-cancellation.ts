import { AsyncLocalStorage } from 'node:async_hooks';

const operationSignalStorage = new AsyncLocalStorage<AbortSignal>();
const DEFAULT_CANCELLATION_MESSAGE = 'Operation stopped by user.';

export class OperationCancelledError extends Error {
  constructor(message = DEFAULT_CANCELLATION_MESSAGE) {
    super(message);
    this.name = 'OperationCancelledError';
  }
}

export function operationCancellationError(reason?: unknown): OperationCancelledError {
  if (reason instanceof OperationCancelledError) return reason;
  if (reason instanceof Error) {
    return new OperationCancelledError(reason.message || DEFAULT_CANCELLATION_MESSAGE);
  }
  if (typeof reason === 'string' && reason.trim()) {
    return new OperationCancelledError(reason.trim());
  }
  return new OperationCancelledError();
}

export function isOperationCancelled(error: unknown): boolean {
  return (
    error instanceof OperationCancelledError
    || (error instanceof Error && (error.name === 'AbortError' || error.name === 'OperationCancelledError'))
  );
}

export function currentOperationSignal(): AbortSignal | undefined {
  return operationSignalStorage.getStore();
}

export function throwIfOperationCancelled(signal = currentOperationSignal()): void {
  if (!signal?.aborted) return;
  throw operationCancellationError(signal.reason);
}

export function withOperationCancellation<T>(
  signal: AbortSignal,
  operation: () => T,
): T {
  return operationSignalStorage.run(signal, operation);
}
