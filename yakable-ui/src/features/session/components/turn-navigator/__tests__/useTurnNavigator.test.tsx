import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SessionService,
  type SessionMessageWindow,
  type SessionTurnNavigationItem,
} from '@/service/session';

import { useTurnNavigator } from '../useTurnNavigator';

const navigation: SessionTurnNavigationItem[] = [
  {
    turnId: 'turn-1',
    userMessageId: 'message-1',
    userMessageSequence: 1,
    preview: 'First',
  },
  {
    turnId: 'turn-2',
    userMessageId: 'message-3',
    userMessageSequence: 3,
    preview: 'Second',
  },
  {
    turnId: 'turn-3',
    userMessageId: 'message-5',
    userMessageSequence: 5,
    preview: 'Third',
  },
];

function setBox(element: HTMLElement, top: number, height: number) {
  element.getBoundingClientRect = () =>
    ({
      x: 0,
      y: top,
      top,
      right: 600,
      bottom: top + height,
      left: 0,
      width: 600,
      height,
      toJSON: () => ({}),
    }) as DOMRect;
}

function addTurn(container: HTMLElement, turnId: string, top: number) {
  const turn = document.createElement('section');
  turn.dataset.turnId = turnId;
  turn.dataset.turnUserLoaded = 'true';
  turn.tabIndex = -1;
  setBox(turn, top, 200);
  container.append(turn);
  return turn;
}

describe('useTurnNavigator', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('loads a target Message Window before jumping to an unloaded Turn', async () => {
    vi.spyOn(SessionService, 'queryTurnNavigation').mockResolvedValue(navigation);

    const targetWindow: SessionMessageWindow = {
      messages: [],
      hasOlder: false,
      hasNewer: true,
      olderCursor: null,
      newerCursor: 10,
    };
    const queryMessageWindow = vi
      .spyOn(SessionService, 'queryMessageWindow')
      .mockResolvedValue(targetWindow);

    const container = document.createElement('div');
    setBox(container, 0, 1000);
    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 1000 },
      scrollHeight: { configurable: true, value: 2200 },
      scrollTop: { configurable: true, writable: true, value: 1200 },
    });
    addTurn(container, 'turn-3', 100);
    document.body.append(container);

    const replaceWindow = vi.fn(() => {
      container.replaceChildren();
      container.scrollTop = 0;
      addTurn(container, 'turn-1', 300);
    });
    const onFollowLatestChange = vi.fn();

    const { result } = renderHook(() =>
      useTurnNavigator({
        projectId: 'project-1',
        sessionId: 'session-1',
        scrollRef: { current: container },
        renderedTurnIds: ['turn-3'],
        navigationRefreshKey: 1,
        replaceWindow,
        restoreLatestWindow: vi.fn().mockResolvedValue(true),
        onFollowLatestChange,
      }),
    );

    await waitFor(() => {
      expect(result.current.items).toHaveLength(3);
    });

    await act(async () => {
      await result.current.jumpToTurn(navigation[0], { focusTarget: true });
    });

    expect(queryMessageWindow).toHaveBeenCalledWith(
      'project-1',
      'session-1',
      1,
      expect.any(AbortSignal),
    );
    expect(replaceWindow).toHaveBeenCalledWith(targetWindow);
    expect(onFollowLatestChange).toHaveBeenCalledWith(false);
    expect(container.scrollTop).toBe(0);
    expect(document.activeElement?.getAttribute('data-turn-id')).toBe('turn-1');
  });

  it('keeps only the latest requested Jump when target-window requests overlap', async () => {
    vi.spyOn(SessionService, 'queryTurnNavigation').mockResolvedValue(navigation);

    let resolveFirst!: (window: SessionMessageWindow) => void;
    let resolveSecond!: (window: SessionMessageWindow) => void;
    const signals: AbortSignal[] = [];

    vi.spyOn(SessionService, 'queryMessageWindow').mockImplementation(
      (_projectId, _sessionId, sequence, signal) => {
        if (signal) signals.push(signal);

        return new Promise<SessionMessageWindow>((resolve) => {
          if (sequence === 1) {
            resolveFirst = resolve;
          } else {
            resolveSecond = resolve;
          }
        });
      },
    );

    const container = document.createElement('div');
    setBox(container, 0, 1000);
    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 1000 },
      scrollHeight: { configurable: true, value: 2200 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    document.body.append(container);

    const replaceWindow = vi.fn((window: SessionMessageWindow) => {
      container.replaceChildren();
      const turnId = window.messages[0]?.turnId;
      if (turnId) addTurn(container, turnId, 300);
    });

    const { result } = renderHook(() =>
      useTurnNavigator({
        projectId: 'project-1',
        sessionId: 'session-1',
        scrollRef: { current: container },
        renderedTurnIds: [],
        navigationRefreshKey: 1,
        replaceWindow,
        restoreLatestWindow: vi.fn().mockResolvedValue(true),
        onFollowLatestChange: vi.fn(),
      }),
    );

    await waitFor(() => {
      expect(result.current.items).toHaveLength(3);
    });

    let firstJump!: Promise<void>;
    let secondJump!: Promise<void>;

    act(() => {
      firstJump = result.current.jumpToTurn(navigation[0]);
    });
    await waitFor(() => {
      expect(signals).toHaveLength(1);
    });

    act(() => {
      secondJump = result.current.jumpToTurn(navigation[1]);
    });
    await waitFor(() => {
      expect(signals).toHaveLength(2);
    });
    expect(signals[0].aborted).toBe(true);

    resolveFirst({
      messages: [
        {
          id: 'message-1',
          turnId: 'turn-1',
          role: 'USER',
          content: 'First',
          sequence: 1,
          createdAt: '2026-09-22T00:00:00Z',
        },
      ],
      hasOlder: false,
      hasNewer: true,
      olderCursor: null,
      newerCursor: 1,
    });
    resolveSecond({
      messages: [
        {
          id: 'message-3',
          turnId: 'turn-2',
          role: 'USER',
          content: 'Second',
          sequence: 3,
          createdAt: '2026-09-22T00:00:02Z',
        },
      ],
      hasOlder: true,
      hasNewer: true,
      olderCursor: 3,
      newerCursor: 3,
    });

    await act(async () => {
      await Promise.all([firstJump, secondJump]);
    });

    expect(replaceWindow).toHaveBeenCalledTimes(1);
    expect(replaceWindow.mock.calls[0][0].messages[0]?.turnId).toBe('turn-2');
  });

  it('restores the real latest Message Window before Terminus scrolls to bottom', async () => {
    vi.spyOn(SessionService, 'queryTurnNavigation').mockResolvedValue(navigation);
    const container = document.createElement('div');
    setBox(container, 0, 1000);
    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 1000 },
      scrollHeight: { configurable: true, value: 2400 },
      scrollTop: { configurable: true, writable: true, value: 300 },
    });
    addTurn(container, 'turn-1', 0);
    document.body.append(container);

    const restoreLatestWindow = vi.fn(async () => {
      container.replaceChildren();
      addTurn(container, 'turn-3', 1200);
      return true;
    });
    const onFollowLatestChange = vi.fn();

    const { result } = renderHook(() =>
      useTurnNavigator({
        projectId: 'project-1',
        sessionId: 'session-1',
        scrollRef: { current: container },
        renderedTurnIds: ['turn-1'],
        navigationRefreshKey: 1,
        replaceWindow: vi.fn(),
        restoreLatestWindow,
        onFollowLatestChange,
      }),
    );

    await waitFor(() => {
      expect(result.current.items).toHaveLength(3);
    });

    await act(async () => {
      await result.current.jumpTerminus();
    });

    expect(restoreLatestWindow).toHaveBeenCalledTimes(1);
    expect(onFollowLatestChange).toHaveBeenCalledWith(true);
    expect(container.scrollTop).toBe(2400);
  });
});
