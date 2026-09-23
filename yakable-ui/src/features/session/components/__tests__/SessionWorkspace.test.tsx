import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SessionService,
  type SessionChanges,
  type SessionSnapshot,
  type SessionTurn,
  type TurnStartResult,
} from '@/service/session';

import { SessionWorkspace } from '../SessionWorkspace';

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

function createSnapshot(
  sessionId = 'session-1',
  title = 'CRM',
  assistantContent = 'I am Yakable.',
): SessionSnapshot {
  return {
    session: {
      id: sessionId,
      projectId: 'project-1',
      title,
      model: {
        provider: 'deepseek',
        model: 'deepseek-flash',
      },
      createdAt: '2026-09-21T00:00:00Z',
      updatedAt: '2026-09-21T00:00:01Z',
    },
    turns: [succeededTurn],
    nextBeforeSequence: null,
    hasMoreMessages: false,
    messages: [
      {
        id: 'message-1',
        turnId: 'turn-1',
        role: 'USER',
        content: 'Who are you?',
        sequence: 1,
        createdAt: '2026-09-21T00:00:00Z',
      },
      {
        id: 'message-2',
        turnId: 'turn-1',
        role: 'ASSISTANT',
        content: assistantContent,
        sequence: 2,
        createdAt: '2026-09-21T00:00:01Z',
      },
    ],
  };
}

const started: TurnStartResult = {
  turn: {
    id: 'turn-2',
    status: 'PENDING',
    attemptCount: 0,
    errorMessage: null,
    invocation: {
      provider: 'deepseek',
      model: 'deepseek-flash',
      usage: null,
      providerRequestId: null,
      finishReason: null,
    },
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

const completedChanges: SessionChanges = {
  latestTurn: {
    ...started.turn,
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
    startedAt: '2026-09-21T00:00:02Z',
    finishedAt: '2026-09-21T00:00:03Z',
    durationMs: 1000,
    updatedAt: '2026-09-21T00:00:03Z',
  },
  messages: [
    started.userMessage,
    {
      id: 'message-4',
      turnId: 'turn-2',
      role: 'ASSISTANT',
      content: 'Streaming reply.',
      sequence: 4,
      createdAt: '2026-09-21T00:00:03Z',
    },
  ],
  latestSequence: 4,
};

const runningTurn: SessionTurn = {
  ...started.turn,
  status: 'RUNNING',
  attemptCount: 1,
  startedAt: '2026-09-21T00:00:02Z',
};

const stoppedTurn: SessionTurn = {
  ...runningTurn,
  status: 'STOPPED',
  finishedAt: '2026-09-21T00:00:03Z',
  durationMs: 1000,
  updatedAt: '2026-09-21T00:00:03Z',
};

const runningSnapshot: SessionSnapshot = {
  ...createSnapshot(),
  turns: [runningTurn],
  messages: [
    {
      ...started.userMessage,
      content: 'Continue',
    },
    {
      id: 'message-4',
      turnId: 'turn-2',
      role: 'ASSISTANT',
      content: 'Partial answer',
      sequence: 4,
      createdAt: '2026-09-21T00:00:03Z',
    },
  ],
};

const stoppedChanges: SessionChanges = {
  latestTurn: stoppedTurn,
  messages: runningSnapshot.messages,
  latestSequence: 4,
};

beforeEach(() => {
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000002');
  vi.spyOn(SessionService, 'queryTurnNavigation').mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SessionWorkspace', () => {
  it('shows loading until the session is available, then renders history', async () => {
    let resolveSession!: (snapshot: SessionSnapshot) => void;
    const pendingSession = new Promise<SessionSnapshot>((resolve) => {
      resolveSession = resolve;
    });

    vi.spyOn(SessionService, 'querySession').mockReturnValue(pendingSession);

    render(<SessionWorkspace projectId="project-1" sessionId="session-1" />);

    expect(screen.getByRole('status', { name: 'Loading session' })).toBeTruthy();

    await act(async () => {
      resolveSession(createSnapshot());
    });

    const userMessage = await screen.findByText('Who are you?');
    const assistantMessage = screen.getByText('I am Yakable.');
    const turnAnchor = userMessage.closest('[data-turn-id="turn-1"]');

    expect(turnAnchor).toBeTruthy();
    expect(turnAnchor?.getAttribute('data-turn-key')).toBe('turn:turn-1');
    expect(turnAnchor?.contains(assistantMessage)).toBe(true);

    const modelTrigger = screen.getByRole('button', {
      name: 'Select model',
    });
    expect(modelTrigger.textContent).toContain('DeepSeek');
    expect(modelTrigger.getAttribute('data-surface')).toBe('chassis');
    expect(screen.queryByTestId('prompt-composer-animated-placeholder')).toBeNull();
    expect(
      screen.getByRole('textbox', { name: 'Send a message' }).getAttribute('placeholder'),
    ).toBe('Ask Yakable...');
    expect(screen.queryByRole('status', { name: 'Loading session' })).toBeNull();
  });

  it('loads an unloaded Turn through the Navigator without changing Session latest progress', async () => {
    const latest = createSnapshot();
    latest.turns = [
      {
        ...succeededTurn,
        id: 'turn-3',
      },
    ];
    latest.messages = [
      {
        id: 'message-5',
        turnId: 'turn-3',
        role: 'USER',
        content: 'Latest prompt',
        sequence: 5,
        createdAt: '2026-09-21T00:00:04Z',
      },
      {
        id: 'message-6',
        turnId: 'turn-3',
        role: 'ASSISTANT',
        content: 'Latest answer',
        sequence: 6,
        createdAt: '2026-09-21T00:00:05Z',
      },
    ];

    vi.spyOn(SessionService, 'querySession').mockResolvedValue(latest);
    vi.mocked(SessionService.queryTurnNavigation).mockResolvedValue([
      {
        turnId: 'turn-1',
        userMessageId: 'message-1',
        userMessageSequence: 1,
        preview: 'First prompt',
      },
      {
        turnId: 'turn-2',
        userMessageId: 'message-3',
        userMessageSequence: 3,
        preview: 'Second prompt',
      },
      {
        turnId: 'turn-3',
        userMessageId: 'message-5',
        userMessageSequence: 5,
        preview: 'Latest prompt',
      },
    ]);
    const queryMessageWindow = vi.spyOn(SessionService, 'queryMessageWindow').mockResolvedValue({
      messages: [
        {
          id: 'message-1',
          turnId: 'turn-1',
          role: 'USER',
          content: 'First prompt',
          sequence: 1,
          createdAt: '2026-09-21T00:00:00Z',
        },
        {
          id: 'message-2',
          turnId: 'turn-1',
          role: 'ASSISTANT',
          content: 'First answer',
          sequence: 2,
          createdAt: '2026-09-21T00:00:01Z',
        },
      ],
      hasOlder: false,
      hasNewer: true,
      olderCursor: null,
      newerCursor: 2,
    });

    const queryMessages = vi.spyOn(SessionService, 'queryMessages').mockResolvedValue({
      messages: latest.messages,
      nextBeforeSequence: null,
      hasMore: false,
    });

    render(<SessionWorkspace projectId="project-1" sessionId="session-1" />);

    expect(await screen.findByText('Latest answer')).toBeTruthy();
    expect(await screen.findByRole('complementary', { name: 'Turn navigator' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Go to turn 1' }));

    await waitFor(() => {
      expect(queryMessageWindow).toHaveBeenCalledWith(
        'project-1',
        'session-1',
        1,
        expect.any(AbortSignal),
      );
    });
    await waitFor(() => {
      const turn = document.querySelector('[data-turn-id="turn-1"]');
      expect(turn?.textContent).toContain('First prompt');
      expect(turn?.textContent).toContain('First answer');
    });
    expect(screen.queryByText('Latest answer')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Scroll to bottom' }));

    await waitFor(() => {
      expect(queryMessages).toHaveBeenCalledWith(
        'project-1',
        'session-1',
        undefined,
        50,
        undefined,
      );
    });
    expect(await screen.findByText('Latest answer')).toBeTruthy();
  });

  it('hides stale content while switching to another session', async () => {
    let resolveSecond!: (snapshot: SessionSnapshot) => void;
    const pendingSecond = new Promise<SessionSnapshot>((resolve) => {
      resolveSecond = resolve;
    });

    vi.spyOn(SessionService, 'querySession')
      .mockResolvedValueOnce(createSnapshot())
      .mockReturnValueOnce(pendingSecond);

    const { rerender } = render(<SessionWorkspace projectId="project-1" sessionId="session-1" />);

    expect(await screen.findByText('I am Yakable.')).toBeTruthy();

    rerender(<SessionWorkspace projectId="project-1" sessionId="session-2" />);

    expect(screen.getByRole('status', { name: 'Loading session' })).toBeTruthy();
    expect(screen.queryByText('I am Yakable.')).toBeNull();

    await act(async () => {
      resolveSecond(createSnapshot('session-2', 'Analytics', 'Second session answer'));
    });

    expect(await screen.findByText('Second session answer')).toBeTruthy();
    expect(screen.queryByText('I am Yakable.')).toBeNull();
  });

  it('shows the user message immediately and streams the assistant reply', async () => {
    const user = userEvent.setup();

    vi.spyOn(SessionService, 'querySession').mockResolvedValue(createSnapshot());
    vi.spyOn(SessionService, 'queryChanges').mockResolvedValue(completedChanges);

    let handlers: Parameters<typeof SessionService.streamingTurn>[5] | undefined;
    let resolveStream!: () => void;

    vi.spyOn(SessionService, 'streamingTurn').mockImplementation(
      async (_projectId, _sessionId, _content, _model, _requestId, nextHandlers) => {
        handlers = nextHandlers;
        await new Promise<void>((resolve) => {
          resolveStream = resolve;
        });
      },
    );

    render(<SessionWorkspace projectId="project-1" sessionId="session-1" />);

    const input = await screen.findByRole('textbox', {
      name: 'Send a message',
    });

    expect(screen.getByRole('button', { name: 'Select model' }).textContent).toContain('DeepSeek');

    await user.type(input, 'Tell me more');
    await user.keyboard('{Enter}');

    expect((input as HTMLTextAreaElement).value).toBe('Tell me more');
    await waitFor(() => {
      expect(
        screen
          .getAllByTestId('user-message-bubble')
          .some((item) => item.textContent?.includes('Tell me more')),
      ).toBe(true);
    });
    expect(SessionService.streamingTurn).toHaveBeenCalledWith(
      'project-1',
      'session-1',
      'Tell me more',
      {
        provider: 'deepseek',
        model: 'deepseek-flash',
      },
      '00000000-0000-4000-8000-000000000002',
      expect.any(Object),
      expect.anything(),
    );
    expect(screen.getByText('Thinking...')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stop generating' })).toBeTruthy();

    await act(async () => {
      handlers?.onStarted(started);
      handlers?.onDelta('Streaming reply.');
    });

    await waitFor(() => {
      expect((input as HTMLTextAreaElement).value).toBe('');
    });
    expect(
      screen
        .getAllByTestId('user-message-bubble')
        .filter((item) => item.textContent?.includes('Tell me more')),
    ).toHaveLength(1);
    expect(await screen.findByText('Streaming reply.')).toBeTruthy();

    await act(async () => {
      resolveStream();
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('button', {
          name: 'Stop generating',
        }),
      ).toBeNull();
    });
  });

  it('keeps the reading position during Streaming and resumes follow output after returning to latest', async () => {
    const user = userEvent.setup();

    vi.spyOn(SessionService, 'querySession').mockResolvedValue(createSnapshot());
    vi.spyOn(SessionService, 'queryChanges').mockResolvedValue(completedChanges);

    let handlers: Parameters<typeof SessionService.streamingTurn>[5] | undefined;
    let resolveStream!: () => void;

    vi.spyOn(SessionService, 'streamingTurn').mockImplementation(
      async (_projectId, _sessionId, _content, _model, _requestId, nextHandlers) => {
        handlers = nextHandlers;
        await new Promise<void>((resolve) => {
          resolveStream = resolve;
        });
      },
    );

    render(<SessionWorkspace projectId="project-1" sessionId="session-1" />);

    expect(await screen.findByText('I am Yakable.')).toBeTruthy();

    const scroll = screen.getByTestId('session-message-scroll') as HTMLDivElement;

    let scrollHeight = 1000;
    Object.defineProperties(scroll, {
      clientHeight: {
        configurable: true,
        value: 400,
      },
      scrollHeight: {
        configurable: true,
        get: () => scrollHeight,
      },
      scrollTop: {
        configurable: true,
        writable: true,
        value: scrollHeight,
      },
    });

    scroll.scrollTop = 100;
    fireEvent.scroll(scroll);

    expect(
      await screen.findByRole('button', {
        name: 'Scroll to bottom',
      }),
    ).toBeTruthy();

    const input = screen.getByRole('textbox', {
      name: 'Send a message',
    });
    await user.type(input, 'Tell me more');
    await user.keyboard('{Enter}');

    await act(async () => {
      handlers?.onStarted(started);
      handlers?.onDelta('First chunk');
    });

    expect(await screen.findByText('First chunk')).toBeTruthy();
    expect(scroll.scrollTop).toBe(100);
    expect(
      screen.getByRole('button', {
        name: 'Scroll to bottom',
      }),
    ).toBeTruthy();

    await user.click(
      screen.getByRole('button', {
        name: 'Scroll to bottom',
      }),
    );

    expect(scroll.scrollTop).toBe(1000);
    expect(
      screen.queryByRole('button', {
        name: 'Scroll to bottom',
      }),
    ).toBeNull();

    scrollHeight = 1200;

    await act(async () => {
      handlers?.onDelta(' second chunk');
    });

    await waitFor(() => {
      expect(scroll.scrollTop).toBe(1200);
    });
    expect(await screen.findByText('First chunk second chunk')).toBeTruthy();

    await act(async () => {
      resolveStream();
    });
  });

  it('loads older messages when the user scrolls to the top', async () => {
    const historySnapshot = createSnapshot();
    historySnapshot.messages = [
      {
        ...historySnapshot.messages[0],
        id: 'message-51',
        sequence: 51,
        content: 'Recent user message',
      },
      {
        ...historySnapshot.messages[1],
        id: 'message-52',
        sequence: 52,
        content: 'Recent assistant message',
      },
    ];
    historySnapshot.nextBeforeSequence = 51;
    historySnapshot.hasMoreMessages = true;

    vi.spyOn(SessionService, 'querySession').mockResolvedValue(historySnapshot);
    const queryMessages = vi.spyOn(SessionService, 'queryMessages').mockResolvedValue({
      messages: [
        {
          id: 'message-1',
          turnId: 'turn-old',
          role: 'USER',
          content: 'Older user message',
          sequence: 1,
          createdAt: '2026-09-20T00:00:00Z',
        },
        {
          id: 'message-2',
          turnId: 'turn-old',
          role: 'ASSISTANT',
          content: 'Older assistant message',
          sequence: 2,
          createdAt: '2026-09-20T00:00:01Z',
        },
      ],
      nextBeforeSequence: null,
      hasMore: false,
    });

    render(<SessionWorkspace projectId="project-1" sessionId="session-1" />);

    expect(await screen.findByText('Recent user message')).toBeTruthy();

    const scroll = screen.getByTestId('session-message-scroll');
    fireEvent.scroll(scroll, { target: { scrollTop: 0 } });

    await waitFor(() => {
      expect(queryMessages).toHaveBeenCalledWith('project-1', 'session-1', 51, 50);
    });
    const olderUser = await screen.findByText('Older user message');
    const olderAssistant = screen.getByText('Older assistant message');
    const olderTurn = olderUser.closest('[data-turn-id="turn-old"]');

    expect(olderTurn).toBeTruthy();
    expect(olderTurn?.contains(olderAssistant)).toBe(true);
  });

  it('keeps the Prompt when streaming fails before started', async () => {
    const user = userEvent.setup();

    vi.spyOn(SessionService, 'querySession').mockResolvedValue(createSnapshot());
    const streamingTurn = vi
      .spyOn(SessionService, 'streamingTurn')
      .mockRejectedValue(new Error('Unable to create turn.'));
    vi.spyOn(SessionService, 'queryChanges').mockRejectedValue(new Error('No turn created.'));

    render(<SessionWorkspace projectId="project-1" sessionId="session-1" />);

    const input = await screen.findByRole('textbox', {
      name: 'Send a message',
    });
    await user.type(input, 'Keep this prompt');
    await user.keyboard('{Enter}');

    expect((await screen.findByRole('alert')).textContent).toContain('Unable to create turn.');
    expect((input as HTMLTextAreaElement).value).toBe('Keep this prompt');

    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(streamingTurn).toHaveBeenCalledTimes(2);
    });
    expect(streamingTurn.mock.calls[0][4]).toBe(streamingTurn.mock.calls[1][4]);
  });

  it('does not expose Edit or Regenerate actions for historical messages', async () => {
    vi.spyOn(SessionService, 'querySession').mockResolvedValue(createSnapshot());

    render(<SessionWorkspace projectId="project-1" sessionId="session-1" />);

    expect(await screen.findByText('Who are you?')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit message' })).toBeNull();
  });

  it('reports Project activity when the user Turn is persisted', async () => {
    const user = userEvent.setup();
    const onActivity = vi.fn();

    vi.spyOn(SessionService, 'querySession').mockResolvedValue(createSnapshot());
    vi.spyOn(SessionService, 'queryChanges').mockResolvedValue(completedChanges);
    vi.spyOn(SessionService, 'streamingTurn').mockImplementation(
      async (_projectId, _sessionId, _content, _model, _requestId, handlers) => {
        handlers.onStarted(started);
      },
    );

    render(
      <SessionWorkspace projectId="project-1" sessionId="session-1" onActivity={onActivity} />,
    );

    const input = await screen.findByRole('textbox', {
      name: 'Send a message',
    });
    await user.type(input, 'Tell me more');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(onActivity).toHaveBeenCalledWith('session-1', started.userMessage.createdAt);
    });
  });

  it('reconnects to the same active Turn after restoring a Session', async () => {
    let handlers: Parameters<typeof SessionService.watchTurn>[3] | undefined;
    let resolveWatch!: () => void;

    const recoveringSnapshot: SessionSnapshot = {
      ...runningSnapshot,
      messages: [
        {
          ...started.userMessage,
          content: 'Continue',
        },
      ],
    };

    vi.spyOn(SessionService, 'querySession').mockResolvedValue(recoveringSnapshot);
    vi.spyOn(SessionService, 'queryChanges').mockResolvedValue(completedChanges);
    const watchTurn = vi
      .spyOn(SessionService, 'watchTurn')
      .mockImplementation(async (_projectId, _sessionId, _turnId, nextHandlers) => {
        handlers = nextHandlers;
        await new Promise<void>((resolve) => {
          resolveWatch = resolve;
        });
      });

    render(<SessionWorkspace projectId="project-1" sessionId="session-1" />);

    await waitFor(() => {
      expect(watchTurn).toHaveBeenCalledWith(
        'project-1',
        'session-1',
        'turn-2',
        expect.any(Object),
        expect.anything(),
      );
    });

    await act(async () => {
      handlers?.onSnapshot('Partial');
      handlers?.onDelta(' answer');
    });

    expect(await screen.findByText('Partial answer')).toBeTruthy();

    await act(async () => {
      resolveWatch();
    });
  });

  it('rewatches the same active Turn after a transient disconnect without clearing partial content', async () => {
    let firstHandlers: Parameters<typeof SessionService.watchTurn>[3] | undefined;
    let secondHandlers: Parameters<typeof SessionService.watchTurn>[3] | undefined;
    let resolveSecondWatch!: () => void;
    let secondWatchCompleted = false;

    const recoveringSnapshot: SessionSnapshot = {
      ...runningSnapshot,
      messages: [
        {
          ...started.userMessage,
          content: 'Continue',
        },
      ],
    };
    const activeChanges: SessionChanges = {
      latestTurn: runningTurn,
      messages: [],
      latestSequence: 3,
    };

    vi.spyOn(SessionService, 'querySession').mockResolvedValue(recoveringSnapshot);
    vi.spyOn(SessionService, 'queryChanges').mockImplementation(async () =>
      secondWatchCompleted ? completedChanges : activeChanges,
    );
    const watchTurn = vi
      .spyOn(SessionService, 'watchTurn')
      .mockImplementationOnce(async (_projectId, _sessionId, _turnId, handlers) => {
        firstHandlers = handlers;
        handlers.onSnapshot('Partial');
        throw new Error('temporary disconnect');
      })
      .mockImplementationOnce(async (_projectId, _sessionId, _turnId, handlers) => {
        secondHandlers = handlers;
        await new Promise<void>((resolve) => {
          resolveSecondWatch = () => {
            secondWatchCompleted = true;
            resolve();
          };
        });
      });

    render(<SessionWorkspace projectId="project-1" sessionId="session-1" />);

    expect(await screen.findByText('Partial')).toBeTruthy();
    expect(firstHandlers).toBeTruthy();

    await waitFor(
      () => {
        expect(watchTurn).toHaveBeenCalledTimes(2);
      },
      { timeout: 2500 },
    );

    expect(screen.getByText('Partial')).toBeTruthy();
    expect(watchTurn.mock.calls[0][2]).toBe('turn-2');
    expect(watchTurn.mock.calls[1][2]).toBe('turn-2');

    await act(async () => {
      secondHandlers?.onSnapshot('Partial');
      secondHandlers?.onDelta(' answer');
    });

    expect(await screen.findByText('Partial answer')).toBeTruthy();

    await act(async () => {
      resolveSecondWatch();
    });

    await waitFor(() => {
      expect(screen.queryByText('Partial answer')).toBeNull();
    });
  });

  it('does not rewatch an active Turn after fallback changes confirm a terminal state', async () => {
    const recoveringSnapshot: SessionSnapshot = {
      ...runningSnapshot,
      messages: [
        {
          ...started.userMessage,
          content: 'Continue',
        },
      ],
    };

    vi.spyOn(SessionService, 'querySession').mockResolvedValue(recoveringSnapshot);
    vi.spyOn(SessionService, 'queryChanges').mockResolvedValue(stoppedChanges);
    const watchTurn = vi
      .spyOn(SessionService, 'watchTurn')
      .mockImplementation(async (_projectId, _sessionId, _turnId, handlers) => {
        handlers.onSnapshot('Partial');
        throw new Error('temporary disconnect');
      });

    render(<SessionWorkspace projectId="project-1" sessionId="session-1" />);

    expect(await screen.findByText('Partial')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Partial answer')).toBeTruthy();
    });

    await new Promise((resolve) => {
      window.setTimeout(resolve, 1200);
    });

    expect(watchTurn).toHaveBeenCalledTimes(1);
  });

  it('aborts the active stream when the workspace unmounts without stopping the Turn', async () => {
    const user = userEvent.setup();
    let streamSignal: AbortSignal | undefined;

    vi.spyOn(SessionService, 'querySession').mockResolvedValue(createSnapshot());
    const stopTurn = vi.spyOn(SessionService, 'stopTurn');
    vi.spyOn(SessionService, 'streamingTurn').mockImplementation(
      async (_projectId, _sessionId, _content, _model, _requestId, handlers, signal) => {
        streamSignal = signal;
        handlers.onStarted(started);
        await new Promise<void>(() => {});
      },
    );

    const { unmount } = render(
      <SessionWorkspace projectId="project-1" sessionId="session-1" />,
    );

    const input = await screen.findByRole('textbox', {
      name: 'Send a message',
    });
    await user.type(input, 'Keep running');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(streamSignal).toBeDefined();
    });

    unmount();

    expect(streamSignal?.aborted).toBe(true);
    expect(stopTurn).not.toHaveBeenCalled();
  });

  it('stops an active turn and keeps the partial answer visible', async () => {
    const user = userEvent.setup();
    const stopTurn = vi.spyOn(SessionService, 'stopTurn').mockResolvedValue(stoppedTurn);

    vi.spyOn(SessionService, 'querySession').mockResolvedValue(runningSnapshot);
    vi.spyOn(SessionService, 'queryChanges').mockResolvedValue(stoppedChanges);
    vi.spyOn(SessionService, 'watchTurn').mockImplementation(
      async () => new Promise<void>(() => {}),
    );

    render(<SessionWorkspace projectId="project-1" sessionId="session-1" />);

    expect(await screen.findByText('Partial answer')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Stop generating' }));

    await waitFor(() => {
      expect(stopTurn).toHaveBeenCalledWith('project-1', 'session-1', 'turn-2');
    });
    expect(screen.getByText('Partial answer')).toBeTruthy();

    await waitFor(() => {
      expect(
        screen.queryByRole('button', {
          name: 'Stop generating',
        }),
      ).toBeNull();
    });
  });
});
