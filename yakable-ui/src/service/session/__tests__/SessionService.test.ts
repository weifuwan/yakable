import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, HttpUtils } from '@/service/http';

import { SessionService } from '../SessionService';
import type {
  SessionSnapshot,
  SessionTurn,
  TurnStartResult,
} from '../types';

const succeededTurn: SessionTurn = {
  id: 'turn-1',
  status: 'SUCCEEDED',
  attemptCount: 1,
  errorMessage: null,
  invocation: {
    provider: 'deepseek',
    model: 'deepseek-flash',
    usage: {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    },
    providerRequestId: 'req-1',
    finishReason: 'stop',
  },
  startedAt: '2026-09-21T00:00:00Z',
  finishedAt: '2026-09-21T00:00:01Z',
  durationMs: 1000,
  createdAt: '2026-09-21T00:00:00Z',
  updatedAt: '2026-09-21T00:00:01Z',
};

const snapshot: SessionSnapshot = {
  session: {
    id: 'session-1',
    projectId: 'project-1',
    title: 'CRM',
    model: {
      provider: 'deepseek',
      model: 'deepseek-flash',
    },
    status: 'ACTIVE',
    createdAt: '2026-09-21T00:00:00Z',
    updatedAt: '2026-09-21T00:00:01Z',
  },
  turns: [succeededTurn],
  messages: [
    {
      id: 'message-1',
      turnId: 'turn-1',
      role: 'USER',
      content: 'Build a CRM',
      sequence: 1,
      createdAt: '2026-09-21T00:00:00Z',
    },
    {
      id: 'message-2',
      turnId: 'turn-1',
      role: 'ASSISTANT',
      content: 'Done.',
      sequence: 2,
      createdAt: '2026-09-21T00:00:01Z',
    },
  ],
};

const started: TurnStartResult = {
  turn: {
    id: 'turn-2',
    status: 'PENDING',
    attemptCount: 0,
    errorMessage: null,
    invocation: null,
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    createdAt: '2026-09-21T00:00:02Z',
    updatedAt: '2026-09-21T00:00:02Z',
  },
  userMessage: {
    id: 'message-3',
    turnId: 'turn-2',
    role: 'USER',
    content: 'Tell me more',
    sequence: 3,
    createdAt: '2026-09-21T00:00:02Z',
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SessionService', () => {
  it('loads a valid session from the encoded session path', async () => {
    const get = vi.spyOn(HttpUtils, 'get').mockResolvedValue(snapshot);

    await expect(
      SessionService.querySession('project 1', 'session/1'),
    ).resolves.toEqual(snapshot);

    expect(get).toHaveBeenCalledWith(
      '/api/projects/project%201/sessions/session%2F1',
      { signal: undefined },
    );
  });

  it('rejects an invalid session response as a parse error', async () => {
    vi.spyOn(HttpUtils, 'get').mockResolvedValue({
      session: { id: 'session-1' },
    });

    await expect(
      SessionService.querySession('project-1', 'session-1'),
    ).rejects.toEqual(
      expect.objectContaining<ApiError>({
        name: 'ApiError',
        kind: 'parse',
      }),
    );
  });

  it('delivers started and delta events and completes the stream', async () => {
    const onStarted = vi.fn();
    const onDelta = vi.fn();

    const postSse = vi
      .spyOn(HttpUtils, 'postSse')
      .mockImplementation(async (_url, _body, onEvent) => {
        onEvent({ event: 'started', data: started });
        onEvent({ event: 'delta', data: { content: 'Hello ' } });
        onEvent({ event: 'delta', data: { content: 'world' } });
        onEvent({ event: 'complete', data: { turnId: 'turn-2' } });
      });

    await SessionService.streamingTurn(
      'project-1',
      'session-1',
      'Tell me more',
      {
        onStarted,
        onDelta,
      },
    );

    expect(postSse).toHaveBeenCalledWith(
      '/api/projects/project-1/sessions/session-1/turns/stream',
      { content: 'Tell me more' },
      expect.any(Function),
      { signal: undefined },
    );
    expect(onStarted).toHaveBeenCalledWith(started);
    expect(onDelta.mock.calls).toEqual([['Hello '], ['world']]);
  });

  it('turns a stream error event into a business error', async () => {
    vi.spyOn(HttpUtils, 'postSse').mockImplementation(
      async (_url, _body, onEvent) => {
        onEvent({
          event: 'error',
          data: { message: 'Provider rejected the request.' },
        });
      },
    );

    await expect(
      SessionService.streamingTurn(
        'project-1',
        'session-1',
        'Hello',
        {
          onStarted: vi.fn(),
          onDelta: vi.fn(),
        },
      ),
    ).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'business',
      message: 'Provider rejected the request.',
    });
  });

  it('fails when the streaming connection ends without complete', async () => {
    vi.spyOn(HttpUtils, 'postSse').mockImplementation(
      async (_url, _body, onEvent) => {
        onEvent({ event: 'started', data: started });
        onEvent({ event: 'delta', data: { content: 'Partial answer' } });
      },
    );

    await expect(
      SessionService.streamingTurn(
        'project-1',
        'session-1',
        'Hello',
        {
          onStarted: vi.fn(),
          onDelta: vi.fn(),
        },
      ),
    ).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'network',
      message: 'Streaming connection ended before completion.',
    });
  });
});
