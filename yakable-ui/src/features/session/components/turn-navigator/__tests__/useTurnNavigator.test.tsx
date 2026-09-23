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
        onFollowLatestChange,
      }),
    );

    await waitFor(() => {
      expect(result.current.items).toHaveLength(3);
    });

    await act(async () => {
      await result.current.jumpToTurn(navigation[0], { focusTarget: true });
    });

    expect(queryMessageWindow).toHaveBeenCalledWith('project-1', 'session-1', 1);
    expect(replaceWindow).toHaveBeenCalledWith(targetWindow);
    expect(onFollowLatestChange).toHaveBeenCalledWith(false);
    expect(container.scrollTop).toBe(0);
    expect(document.activeElement?.getAttribute('data-turn-id')).toBe('turn-1');
  });
});
