import type {
  SessionChanges,
  SessionMessage,
  SessionMessagePage,
  SessionSnapshot,
  SessionTurn,
  TurnInvocation,
  TurnStartResult,
} from '../types';

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
  const validUsage =
    usage === null ||
    (
      isRecord(usage) &&
      isNullableNumber(usage.inputTokens) &&
      isNullableNumber(usage.outputTokens) &&
      isNullableNumber(usage.totalTokens)
    );

  return (
    typeof value.provider === 'string' &&
    typeof value.model === 'string' &&
    validUsage &&
    isNullableString(value.providerRequestId) &&
    isNullableString(value.finishReason)
  );
}

function isSessionMessage(value: unknown): value is SessionMessage {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.turnId === 'string' &&
    (value.role === 'USER' || value.role === 'ASSISTANT') &&
    typeof value.content === 'string' &&
    typeof value.sequence === 'number' &&
    typeof value.createdAt === 'string'
  );
}

function isSessionTurn(value: unknown): value is SessionTurn {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    (
      value.status === 'PENDING' ||
      value.status === 'RUNNING' ||
      value.status === 'SUCCEEDED' ||
      value.status === 'FAILED'
    ) &&
    typeof value.attemptCount === 'number' &&
    isNullableString(value.errorMessage) &&
    (value.invocation === null || isTurnInvocation(value.invocation)) &&
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
  const model = session.model;

  return (
    typeof session.id === 'string' &&
    typeof session.projectId === 'string' &&
    typeof session.title === 'string' &&
    (session.status === 'ACTIVE' || session.status === 'ARCHIVED') &&
    typeof session.createdAt === 'string' &&
    typeof session.updatedAt === 'string' &&
    isRecord(model) &&
    typeof model.provider === 'string' &&
    typeof model.model === 'string' &&
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
    (
      value.nextBeforeSequence === null ||
      typeof value.nextBeforeSequence === 'number'
    ) &&
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

async function readJson(response: Response, errorMessage: string) {
  try {
    return await response.json() as unknown;
  } catch (error) {
    throw new Error(errorMessage, { cause: error });
  }
}

function sessionPath(projectId: string, sessionId: string) {
  return (
    '/api/projects/' +
    encodeURIComponent(projectId) +
    '/sessions/' +
    encodeURIComponent(sessionId)
  );
}

function parseSseEvent(block: string) {
  let event = 'message';
  const data: string[] = [];

  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data.push(line.slice(5).trimStart());
    }
  }

  return { event, data: data.join('\n') };
}

function parseEventJson(data: string, errorMessage: string) {
  try {
    return JSON.parse(data) as unknown;
  } catch (error) {
    throw new Error(errorMessage, { cause: error });
  }
}

export async function getSession(
  projectId: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<SessionSnapshot> {
  let response: Response;

  try {
    response = await fetch(sessionPath(projectId, sessionId), {
      headers: {
        Accept: 'application/json',
      },
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Unable to load session.', { cause: error });
  }

  if (!response.ok) {
    throw new Error('Unable to load session (HTTP ' + response.status + ').');
  }

  const data = await readJson(
    response,
    'Session API returned invalid JSON.',
  );

  if (!isSessionSnapshot(data)) {
    throw new Error('Session API returned an invalid response.');
  }

  return data;
}

export async function getSessionChanges(
  projectId: string,
  sessionId: string,
  afterSequence: number,
  signal?: AbortSignal,
): Promise<SessionChanges> {
  const params = new URLSearchParams({
    afterSequence: String(afterSequence),
  });

  const response = await fetch(
    sessionPath(projectId, sessionId) + '/changes?' + params.toString(),
    {
      headers: {
        Accept: 'application/json',
      },
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(
      'Unable to refresh session (HTTP ' + response.status + ').',
    );
  }

  const data = await readJson(
    response,
    'Session changes API returned invalid JSON.',
  );

  if (!isSessionChanges(data)) {
    throw new Error('Session changes API returned an invalid response.');
  }

  return data;
}

export async function getSessionMessages(
  projectId: string,
  sessionId: string,
  beforeSequence?: number,
  limit = 50,
  signal?: AbortSignal,
): Promise<SessionMessagePage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (beforeSequence !== undefined) {
    params.set('beforeSequence', String(beforeSequence));
  }

  const response = await fetch(
    sessionPath(projectId, sessionId) + '/messages?' + params.toString(),
    {
      headers: {
        Accept: 'application/json',
      },
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(
      'Unable to load session messages (HTTP ' + response.status + ').',
    );
  }

  const data = await readJson(
    response,
    'Session messages API returned invalid JSON.',
  );

  if (!isSessionMessagePage(data)) {
    throw new Error(
      'Session messages API returned an invalid response.',
    );
  }

  return data;
}

export async function streamSessionTurn(
  projectId: string,
  sessionId: string,
  content: string,
  handlers: {
    onStarted: (result: TurnStartResult) => void;
    onDelta: (content: string) => void;
  },
  signal?: AbortSignal,
) {
  const response = await fetch(sessionPath(projectId, sessionId) + '/turns/stream', {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
    signal,
  });

  if (!response.ok) {
    throw new Error('Unable to stream turn (HTTP ' + response.status + ').');
  }
  if (!response.body) {
    throw new Error('Streaming response body is unavailable.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    buffer = buffer.replace(/\r\n/g, '\n');

    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
      if (!block) continue;

      const event = parseSseEvent(block);
      if (event.event === 'started') {
        const data = parseEventJson(event.data, 'Streaming start event is invalid.');
        if (!isTurnStartResult(data)) {
          throw new Error('Streaming start event is invalid.');
        }
        handlers.onStarted(data);
      } else if (event.event === 'delta') {
        const data = parseEventJson(event.data, 'Streaming delta event is invalid.');
        if (!isRecord(data) || typeof data.content !== 'string') {
          throw new Error('Streaming delta event is invalid.');
        }
        handlers.onDelta(data.content);
      } else if (event.event === 'error') {
        const data = parseEventJson(event.data, 'Streaming error event is invalid.');
        throw new Error(
          isRecord(data) && typeof data.message === 'string'
            ? data.message
            : 'Streaming turn failed.',
        );
      } else if (event.event === 'complete') {
        return;
      }
    }

    if (done) {
      break;
    }
  }

  throw new Error('Streaming connection ended before completion.');
}
