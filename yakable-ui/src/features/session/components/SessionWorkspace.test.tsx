import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionWorkspace } from './SessionWorkspace';

const completedSnapshot = {
  session: {
    id: 'session-1',
    projectId: 'project-1',
    title: 'CRM',
    model: {
      provider: 'deepseek',
      model: 'deepseek-flash',
    },
    status: 'ACTIVE',
    createdAt: '2026-09-19T00:00:00Z',
    updatedAt: '2026-09-19T00:00:01Z',
  },
  turns: [
    {
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
      startedAt: '2026-09-19T00:00:00Z',
      finishedAt: '2026-09-19T00:00:01Z',
      durationMs: 1000,
      createdAt: '2026-09-19T00:00:00Z',
      updatedAt: '2026-09-19T00:00:01Z',
    },
  ],
  messages: [
    {
      id: 'message-1',
      turnId: 'turn-1',
      role: 'USER',
      content: 'Who are you?',
      sequence: 1,
      createdAt: '2026-09-19T00:00:00Z',
    },
    {
      id: 'message-2',
      turnId: 'turn-1',
      role: 'ASSISTANT',
      content: 'I am Yakable.',
      sequence: 2,
      createdAt: '2026-09-19T00:00:01Z',
    },
  ],
} as const;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SessionWorkspace', () => {
  it('loads an existing session without creating messages on mount', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => completedSnapshot,
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <SessionWorkspace
        projectId="project-1"
        sessionId="session-1"
      />,
    );

    expect(await screen.findByText('I am Yakable.')).toBeTruthy();
    expect(screen.getByText('Who are you?')).toBeTruthy();

    const writeCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'POST',
    );
    expect(writeCall).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/project-1/sessions/session-1',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('creates a turn and appends the accepted user message', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return {
            ok: true,
            status: 202,
            json: async () => ({
              turn: {
                id: 'turn-2',
                status: 'PENDING',
                attemptCount: 0,
                errorMessage: null,
                invocation: null,
                startedAt: null,
                finishedAt: null,
                durationMs: null,
                createdAt: '2026-09-19T00:00:02Z',
                updatedAt: '2026-09-19T00:00:02Z',
              },
              userMessage: {
                id: 'message-3',
                turnId: 'turn-2',
                role: 'USER',
                content: 'Tell me more',
                sequence: 3,
                createdAt: '2026-09-19T00:00:02Z',
              },
            }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => completedSnapshot,
        };
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    render(
      <SessionWorkspace
        projectId="project-1"
        sessionId="session-1"
      />,
    );

    const input = await screen.findByRole('textbox', {
      name: 'Send a message',
    });
    fireEvent.change(input, { target: { value: 'Tell me more' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Tell me more')).toBeTruthy();
    expect(await screen.findByText('Yakable is working...')).toBeTruthy();

    const postCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'POST',
    );
    expect(postCall?.[0]).toBe(
      '/api/projects/project-1/sessions/session-1/turns',
    );
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      content: 'Tell me more',
    });

    await waitFor(() => {
      expect((input as HTMLTextAreaElement).value).toBe('');
    });
  });
});
