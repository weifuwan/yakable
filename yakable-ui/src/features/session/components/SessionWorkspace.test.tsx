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

const streamedTurn = {
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
} as const;

const runningSnapshot = {
  ...completedSnapshot,
  turns: [
    {
      ...streamedTurn.turn,
      status: 'RUNNING',
      attemptCount: 1,
      startedAt: '2026-09-19T00:00:02Z',
    },
  ],
} as const;

const cancelledTurn = {
  ...streamedTurn.turn,
  status: 'CANCELLED',
  attemptCount: 1,
  startedAt: '2026-09-19T00:00:02Z',
  finishedAt: '2026-09-19T00:00:03Z',
  durationMs: 1000,
  updatedAt: '2026-09-19T00:00:03Z',
} as const;

const cancelledChanges = {
  latestTurn: cancelledTurn,
  messages: [
    streamedTurn.userMessage,
    {
      id: 'message-4',
      turnId: 'turn-2',
      role: 'ASSISTANT',
      content: 'Partial answer',
      sequence: 4,
      createdAt: '2026-09-19T00:00:03Z',
    },
  ],
  latestSequence: 4,
} as const;

const completedChanges = {
  latestTurn: {
    ...streamedTurn.turn,
    status: 'SUCCEEDED',
    attemptCount: 1,
    invocation: {
      provider: 'deepseek',
      model: 'deepseek-flash',
      usage: {
        inputTokens: 20,
        outputTokens: 6,
        totalTokens: 26,
      },
      providerRequestId: 'req-2',
      finishReason: 'stop',
    },
    startedAt: '2026-09-19T00:00:02Z',
    finishedAt: '2026-09-19T00:00:03Z',
    durationMs: 1000,
    updatedAt: '2026-09-19T00:00:03Z',
  },
  messages: [
    streamedTurn.userMessage,
    {
      id: 'message-4',
      turnId: 'turn-2',
      role: 'ASSISTANT',
      content: 'Streaming reply.',
      sequence: 4,
      createdAt: '2026-09-19T00:00:03Z',
    },
  ],
  latestSequence: 4,
} as const;

function apiResponse(data: unknown) {
  return new Response(
    JSON.stringify({ code: 0, message: 'Success', data }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function streamResponse() {
  const encoder = new TextEncoder();
  const chunks = [
    'event: started\ndata: ' + JSON.stringify(streamedTurn) + '\n\n' +
      'event: delta\ndata: {"content":"Streaming "}\n\n',
    'event: delta\ndata: {"content":"reply."}\n\n' +
      'event: complete\ndata: {"turnId":"turn-2"}\n\n',
  ];

  return new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    },
  );
}

function setScrollMetrics(
  element: HTMLElement,
  {
    scrollHeight,
    clientHeight,
    scrollTop,
  }: {
    scrollHeight: number;
    clientHeight: number;
    scrollTop: number;
  },
) {
  Object.defineProperties(element, {
    scrollHeight: { configurable: true, value: scrollHeight },
    clientHeight: { configurable: true, value: clientHeight },
    scrollTop: { configurable: true, writable: true, value: scrollTop },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SessionWorkspace', () => {
  it('loads an existing session without creating messages on mount', async () => {
    const fetchMock = vi.fn().mockResolvedValue(apiResponse(completedSnapshot));
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

  it('shows a scroll-to-bottom button when the user scrolls away from the bottom', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(apiResponse(completedSnapshot)),
    );

    render(
      <SessionWorkspace
        projectId="project-1"
        sessionId="session-1"
      />,
    );

    await screen.findByText('I am Yakable.');

    const scroller = screen.getByTestId('session-message-scroll');
    setScrollMetrics(scroller, {
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 100,
    });
    fireEvent.scroll(scroller);

    const button = screen.getByRole('button', { name: 'Scroll to bottom' });
    fireEvent.click(button);

    expect(scroller.scrollTop).toBe(1000);
    expect(button.style.borderRadius).toBe('50%');
    expect(button.style.backgroundColor).toBeTruthy();
    expect(button.className).toContain('cursor-pointer');
    expect(button.className).toContain('hover:shadow-md');
    expect(button.getAttribute('data-allow-shadow')).toBe('true');
    expect(
      screen.queryByRole('button', { name: 'Scroll to bottom' }),
    ).toBeNull();
  });

  it('shows an ellipsis scroll button while a turn is running', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse(runningSnapshot)));

    render(
      <SessionWorkspace
        projectId="project-1"
        sessionId="session-1"
      />,
    );

    await screen.findByText('Who are you?');

    const scroller = screen.getByTestId('session-message-scroll');
    setScrollMetrics(scroller, {
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 100,
    });
    fireEvent.scroll(scroller);

    const button = screen.getByRole('button', { name: 'Scroll to bottom' });
    expect(button.querySelector('svg')).toBeNull();
    expect(button.querySelectorAll('.size-1')).toHaveLength(3);
  });

  it('shows the user message and Thinking before the server starts streaming', async () => {
    let resolveStream!: (response: Response) => void;
    const pendingStream = new Promise<Response>((resolve) => {
      resolveStream = resolve;
    });
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (
          init?.method === 'POST' &&
          String(input).endsWith('/turns/stream')
        ) {
          return pendingStream;
        }
        if (String(input).includes('/changes?')) {
          return apiResponse(completedChanges);
        }
        return apiResponse(completedSnapshot);
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
    expect(screen.getByText('Thinking...')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Stop generating' }),
    ).toBeTruthy();
    await waitFor(() => {
      expect((input as HTMLTextAreaElement).value).toBe('');
    });

    resolveStream(streamResponse());

    expect(await screen.findByText('Streaming reply.')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByText('Tell me more')).toHaveLength(1);
    });
  });

  it('stops an active streaming turn', async () => {
    const encoder = new TextEncoder();
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (
          init?.method === 'POST' &&
          String(input).endsWith('/turns/stream')
        ) {
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(
                  encoder.encode(
                    'event: started\ndata: ' +
                      JSON.stringify(streamedTurn) +
                      '\n\n' +
                      'event: delta\ndata: {"content":"Partial answer"}\n\n',
                  ),
                );
                init.signal?.addEventListener('abort', () => {
                  controller.close();
                });
              },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'text/event-stream' },
            },
          );
        }

        if (
          init?.method === 'POST' &&
          String(input).endsWith('/turns/turn-2/cancel')
        ) {
          return apiResponse(cancelledTurn);
        }

        if (String(input).includes('/changes?')) {
          return apiResponse(cancelledChanges);
        }

        return apiResponse(completedSnapshot);
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
    expect(await screen.findByText('Partial answer')).toBeTruthy();
    await waitFor(() => {
      expect((input as HTMLTextAreaElement).value).toBe('');
    });

    const stopButton = screen.getByRole('button', {
      name: 'Stop generating',
    });
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            init?.method === 'POST' &&
            String(url).endsWith('/turns/turn-2/cancel'),
        ),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Stop generating' }),
      ).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getAllByText('Partial answer')).toHaveLength(1);
    });
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('/changes?')),
    ).toBe(true);
  });

  it('streams assistant content through SessionService', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return streamResponse();
        }
        if (String(input).includes('/changes?')) {
          return apiResponse(completedChanges);
        }
        return apiResponse(completedSnapshot);
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
    expect(await screen.findByText('Streaming reply.')).toBeTruthy();

    const postCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'POST',
    );
    expect(postCall?.[0]).toBe(
      '/api/projects/project-1/sessions/session-1/turns/stream',
    );
    expect(postCall?.[1]?.headers).toEqual(
      expect.objectContaining({ Accept: 'text/event-stream' }),
    );
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      content: 'Tell me more',
    });

    await waitFor(() => {
      expect((input as HTMLTextAreaElement).value).toBe('');
    });
  });
});
