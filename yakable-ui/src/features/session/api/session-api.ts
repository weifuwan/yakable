import type {
  SessionMessage,
  SessionSnapshot,
  SessionTurn,
  TurnStartResult,
} from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    (value.errorMessage === null || typeof value.errorMessage === 'string') &&
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

export async function startSessionTurn(
  projectId: string,
  sessionId: string,
  content: string,
): Promise<TurnStartResult> {
  let response: Response;

  try {
    response = await fetch(
      sessionPath(projectId, sessionId) + '/turns',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      },
    );
  } catch (error) {
    throw new Error('Unable to start turn.', { cause: error });
  }

  if (!response.ok) {
    throw new Error('Unable to start turn (HTTP ' + response.status + ').');
  }

  const data = await readJson(
    response,
    'Session API returned invalid JSON.',
  );

  if (!isTurnStartResult(data)) {
    throw new Error('Session API returned an invalid turn.');
  }

  return data;
}
