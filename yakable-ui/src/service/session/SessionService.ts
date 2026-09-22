import { ApiError, HttpUtils } from '../http';
import type {
  SessionChanges,
  SessionMessage,
  SessionMessagePage,
  SessionModel,
  SessionSnapshot,
  SessionTurn,
  TurnInvocation,
  TurnStartResult,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown) {
  return value === null || typeof value === 'string';
}

function isNullableNumber(value: unknown) {
  return value === null || typeof value === 'number';
}

function isTurnInvocation(value: unknown): value is TurnInvocation {
  if (!isRecord(value)) return false;
  const usage = value.usage;

  return (
    (usage === null ||
      (isRecord(usage) &&
        isNullableNumber(usage.inputTokens) &&
        isNullableNumber(usage.outputTokens) &&
        isNullableNumber(usage.totalTokens))) &&
    typeof value.provider === 'string' &&
    typeof value.model === 'string' &&
    isNullableString(value.providerRequestId) &&
    isNullableString(value.finishReason)
  );
}

function isSessionMessage(value: unknown): value is SessionMessage {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.turnId === 'string' &&
    (value.role === 'USER' || value.role === 'ASSISTANT') &&
    typeof value.content === 'string' &&
    typeof value.sequence === 'number' &&
    typeof value.createdAt === 'string'
  );
}

function isSessionTurn(value: unknown): value is SessionTurn {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'STOPPED'].includes(
      String(value.status),
    ) &&
    typeof value.attemptCount === 'number' &&
    isNullableString(value.errorMessage) &&
    isTurnInvocation(value.invocation) &&
    isNullableString(value.startedAt) &&
    isNullableString(value.finishedAt) &&
    isNullableNumber(value.durationMs) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isSessionSnapshot(value: unknown): value is SessionSnapshot {
  if (!isRecord(value) || !isRecord(value.session)) return false;
  const session = value.session;

  return (
    typeof session.id === 'string' &&
    typeof session.projectId === 'string' &&
    typeof session.title === 'string' &&
    typeof session.createdAt === 'string' &&
    typeof session.updatedAt === 'string' &&
    isRecord(session.model) &&
    typeof session.model.provider === 'string' &&
    typeof session.model.model === 'string' &&
    Array.isArray(value.turns) &&
    value.turns.every(isSessionTurn) &&
    Array.isArray(value.messages) &&
    value.messages.every(isSessionMessage)
  );
}

function isSessionChanges(value: unknown): value is SessionChanges {
  return (
    isRecord(value) &&
    isSessionTurn(value.latestTurn) &&
    Array.isArray(value.messages) &&
    value.messages.every(isSessionMessage) &&
    typeof value.latestSequence === 'number'
  );
}

function isSessionMessagePage(value: unknown): value is SessionMessagePage {
  return (
    isRecord(value) &&
    Array.isArray(value.messages) &&
    value.messages.every(isSessionMessage) &&
    (value.nextBeforeSequence === null ||
      typeof value.nextBeforeSequence === 'number') &&
    typeof value.hasMore === 'boolean'
  );
}

function isTurnStartResult(value: unknown): value is TurnStartResult {
  return (
    isRecord(value) &&
    isSessionTurn(value.turn) &&
    isSessionMessage(value.userMessage) &&
    value.userMessage.role === 'USER'
  );
}

function invalidResponse(message: string, data: unknown): never {
  throw new ApiError(message, { kind: 'parse', data });
}

function sessionPath(projectId: string, sessionId: string) {
  return (
    '/api/projects/' +
    encodeURIComponent(projectId) +
    '/sessions/' +
    encodeURIComponent(sessionId)
  );
}

async function querySession(
  projectId: string,
  sessionId: string,
  signal?: AbortSignal,
) {
  const data = await HttpUtils.get<unknown>(
    sessionPath(projectId, sessionId),
    { signal },
  );
  return isSessionSnapshot(data)
    ? data
    : invalidResponse('Session API returned an invalid response.', data);
}

async function queryChanges(
  projectId: string,
  sessionId: string,
  afterSequence: number,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    afterSequence: String(afterSequence),
  });
  const data = await HttpUtils.get<unknown>(
    sessionPath(projectId, sessionId) + '/changes?' + params.toString(),
    { signal },
  );
  return isSessionChanges(data)
    ? data
    : invalidResponse('Session changes API returned an invalid response.', data);
}

async function queryMessages(
  projectId: string,
  sessionId: string,
  beforeSequence?: number,
  limit = 50,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (beforeSequence !== undefined) {
    params.set('beforeSequence', String(beforeSequence));
  }

  const data = await HttpUtils.get<unknown>(
    sessionPath(projectId, sessionId) + '/messages?' + params.toString(),
    { signal },
  );
  return isSessionMessagePage(data)
    ? data
    : invalidResponse('Session messages API returned an invalid response.', data);
}

async function addTurn(
  projectId: string,
  sessionId: string,
  content: string,
  model: SessionModel,
  signal?: AbortSignal,
) {
  const data = await HttpUtils.post<unknown>(
    sessionPath(projectId, sessionId) + '/turns',
    {
      content,
      provider: model.provider,
      model: model.model,
    },
    { signal },
  );
  return isTurnStartResult(data)
    ? data
    : invalidResponse('Session API returned an invalid turn.', data);
}

async function stopTurn(
  projectId: string,
  sessionId: string,
  turnId: string,
  signal?: AbortSignal,
) {
  const data = await HttpUtils.post<unknown>(
    sessionPath(projectId, sessionId) +
      '/turns/' +
      encodeURIComponent(turnId) +
      '/stop',
    {},
    { signal },
  );
  return isSessionTurn(data)
    ? data
    : invalidResponse('Session API returned an invalid turn.', data);
}

async function streamingTurn(
  projectId: string,
  sessionId: string,
  content: string,
  model: SessionModel,
  handlers: {
    onStarted: (result: TurnStartResult) => void;
    onSnapshot?: (content: string) => void;
    onDelta: (content: string) => void;
    onStopped?: () => void;
  },
  signal?: AbortSignal,
) {
  let completed = false;

  await HttpUtils.postSse(
    sessionPath(projectId, sessionId) + '/turns/stream',
    {
      content,
      provider: model.provider,
      model: model.model,
    },
    ({ event, data }) => {
      if (event === 'started') {
        if (!isTurnStartResult(data)) {
          invalidResponse('Streaming start event is invalid.', data);
        }
        handlers.onStarted(data);
        return;
      }

      if (event === 'snapshot') {
        if (!isRecord(data) || typeof data.content !== 'string') {
          invalidResponse('Streaming snapshot event is invalid.', data);
        }
        handlers.onSnapshot?.(data.content);
        return;
      }

      if (event === 'delta') {
        if (!isRecord(data) || typeof data.content !== 'string') {
          invalidResponse('Streaming delta event is invalid.', data);
        }
        handlers.onDelta(data.content);
        return;
      }

      if (event === 'error') {
        throw new ApiError(
          isRecord(data) && typeof data.message === 'string'
            ? data.message
            : 'Streaming turn failed.',
          { kind: 'business', data },
        );
      }

      if (event === 'complete') completed = true;
      if (event === 'stopped') {
        completed = true;
        handlers.onStopped?.();
      }
    },
    { signal },
  );

  if (!completed) {
    throw new ApiError('Streaming connection ended before completion.', {
      kind: 'network',
    });
  }
}


async function watchTurn(
  projectId: string,
  sessionId: string,
  turnId: string,
  handlers: {
    onSnapshot: (content: string) => void;
    onDelta: (content: string) => void;
    onStopped?: () => void;
  },
  signal?: AbortSignal,
) {
  let terminal = false;

  await HttpUtils.postSse(
    sessionPath(projectId, sessionId) +
      '/turns/' +
      encodeURIComponent(turnId) +
      '/stream',
    {},
    ({ event, data }) => {
      if (event === 'snapshot') {
        if (!isRecord(data) || typeof data.content !== 'string') {
          invalidResponse('Streaming snapshot event is invalid.', data);
        }
        handlers.onSnapshot(data.content);
        return;
      }

      if (event === 'delta') {
        if (!isRecord(data) || typeof data.content !== 'string') {
          invalidResponse('Streaming delta event is invalid.', data);
        }
        handlers.onDelta(data.content);
        return;
      }

      if (event === 'error') {
        terminal = true;
        throw new ApiError(
          isRecord(data) && typeof data.message === 'string'
            ? data.message
            : 'Streaming turn failed.',
          { kind: 'business', data },
        );
      }

      if (event === 'complete') {
        terminal = true;
        return;
      }

      if (event === 'stopped') {
        terminal = true;
        handlers.onStopped?.();
      }
    },
    { signal },
  );

  if (!terminal) {
    throw new ApiError('Streaming connection ended before completion.', {
      kind: 'network',
    });
  }
}

export const SessionService = {
  querySession,
  queryChanges,
  queryMessages,
  addTurn,
  stopTurn,
  streamingTurn,
  watchTurn,
};
