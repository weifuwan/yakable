import {
  act,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

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

const cancelledTurn: SessionTurn = {
  ...runningTurn,
  status: 'CANCELLED',
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

const cancelledChanges: SessionChanges = {
  latestTurn: cancelledTurn,
  messages: runningSnapshot.messages,
  latestSequence: 4,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SessionWorkspace', () => {
  it('shows loading until the session is available, then renders history', async () => {
    let resolveSession!: (snapshot: SessionSnapshot) => void;
    const pendingSession = new Promise<SessionSnapshot>((resolve) => {
      resolveSession = resolve;
    });

    vi.spyOn(SessionService, 'querySession').mockReturnValue(
      pendingSession,
    );

    render(
      <SessionWorkspace
        projectId="project-1"
        sessionId="session-1"
      />,
    );

    expect(
      screen.getByRole('status', { name: 'Loading session' }),
    ).toBeTruthy();

    await act(async () => {
      resolveSession(createSnapshot());
    });

    expect(await screen.findByText('Who are you?')).toBeTruthy();
    expect(screen.getByText('I am Yakable.')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Select model' }).textContent,
    ).toContain('DeepSeek');
    expect(
      screen.queryByRole('status', { name: 'Loading session' }),
    ).toBeNull();
  });

  it('hides stale content while switching to another session', async () => {
    let resolveSecond!: (snapshot: SessionSnapshot) => void;
    const pendingSecond = new Promise<SessionSnapshot>((resolve) => {
      resolveSecond = resolve;
    });

    vi.spyOn(SessionService, 'querySession')
      .mockResolvedValueOnce(createSnapshot())
      .mockReturnValueOnce(pendingSecond);

    const { rerender } = render(
      <SessionWorkspace
        projectId="project-1"
        sessionId="session-1"
      />,
    );

    expect(await screen.findByText('I am Yakable.')).toBeTruthy();

    rerender(
      <SessionWorkspace
        projectId="project-1"
        sessionId="session-2"
      />,
    );

    expect(
      screen.getByRole('status', { name: 'Loading session' }),
    ).toBeTruthy();
    expect(screen.queryByText('I am Yakable.')).toBeNull();

    await act(async () => {
      resolveSecond(
        createSnapshot(
          'session-2',
          'Analytics',
          'Second session answer',
        ),
      );
    });

    expect(
      await screen.findByText('Second session answer'),
    ).toBeTruthy();
    expect(screen.queryByText('I am Yakable.')).toBeNull();
  });

  it('shows the user message immediately and streams the assistant reply', async () => {
    const user = userEvent.setup();

    vi.spyOn(SessionService, 'querySession').mockResolvedValue(
      createSnapshot(),
    );
    vi.spyOn(SessionService, 'queryChanges').mockResolvedValue(
      completedChanges,
    );

    let handlers:
      | Parameters<typeof SessionService.streamingTurn>[4]
      | undefined;
    let resolveStream!: () => void;

    vi.spyOn(SessionService, 'streamingTurn').mockImplementation(
      async (
        _projectId,
        _sessionId,
        _content,
        _model,
        nextHandlers,
      ) => {
        handlers = nextHandlers;
        await new Promise<void>((resolve) => {
          resolveStream = resolve;
        });
      },
    );

    render(
      <SessionWorkspace
        projectId="project-1"
        sessionId="session-1"
      />,
    );

    const input = await screen.findByRole('textbox', {
      name: 'Send a message',
    });

    await user.click(
      screen.getByRole('button', { name: 'Select model' }),
    );
    await user.click(
      screen.getByRole('menuitemradio', { name: 'Kimi' }),
    );

    await user.type(input, 'Tell me more');
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Tell me more')).toBeTruthy();
    expect(SessionService.streamingTurn).toHaveBeenCalledWith(
      'project-1',
      'session-1',
      'Tell me more',
      {
        provider: 'kimi',
        model: 'kimi-k3',
      },
      expect.any(Object),
      expect.anything(),
    );
    expect(screen.getByText('Thinking...')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Stop generating' }),
    ).toBeTruthy();

    await act(async () => {
      handlers?.onStarted(started);
      handlers?.onDelta('Streaming reply.');
    });

    expect(
      await screen.findByText('Streaming reply.'),
    ).toBeTruthy();

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

  it('stops an active turn and keeps the partial answer visible', async () => {
    const user = userEvent.setup();
    const cancelTurn = vi
      .spyOn(SessionService, 'cancelTurn')
      .mockResolvedValue(cancelledTurn);

    vi.spyOn(SessionService, 'querySession').mockResolvedValue(
      runningSnapshot,
    );
    vi.spyOn(SessionService, 'queryChanges').mockResolvedValue(
      cancelledChanges,
    );

    render(
      <SessionWorkspace
        projectId="project-1"
        sessionId="session-1"
      />,
    );

    expect(await screen.findByText('Partial answer')).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: 'Stop generating' }),
    );

    await waitFor(() => {
      expect(cancelTurn).toHaveBeenCalledWith(
        'project-1',
        'session-1',
        'turn-2',
      );
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
