import { useLayoutEffect, useMemo, useRef } from 'react';

import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionMessage } from '@/service/session';

import { TurnItem, type TurnRenderModel } from '../../components/TurnItem';
import {
  selectMountedTurnKeys,
  type TurnWindowLayoutEntry,
  useTurnWindowing,
} from '../useTurnWindowing';

let resizeCallback: ResizeObserverCallback | null = null;

class TestResizeObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }

  observe() {}

  unobserve() {}

  disconnect() {}
}

function turnModel(index: number): TurnRenderModel {
  const userMessage: SessionMessage = {
    id: 'message-user-' + index,
    turnId: 'turn-' + index,
    role: 'USER',
    content: 'Prompt ' + index,
    sequence: index * 2 - 1,
    createdAt: '2026-09-23T00:00:00Z',
  };
  const assistantMessage: SessionMessage = {
    id: 'message-assistant-' + index,
    turnId: 'turn-' + index,
    role: 'ASSISTANT',
    content: 'Answer ' + index,
    sequence: index * 2,
    createdAt: '2026-09-23T00:00:01Z',
  };

  return {
    key: 'turn:turn-' + index,
    turnId: 'turn-' + index,
    userMessage,
    assistantMessages: [assistantMessage],
    streamingMessage: null,
    status: 'SUCCEEDED',
    isThinking: false,
    failureMessage: null,
  };
}

function WindowingHarness({
  count,
  pinnedTurnKeys,
}: {
  count: number;
  pinnedTurnKeys: string[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const turnKeys = useMemo(
    () => Array.from({ length: count }, (_, index) => 'turn:turn-' + (index + 1)),
    [count],
  );
  const { isTurnMounted, measuredHeight, reportTurnHeight } = useTurnWindowing({
    scrollRef,
    turnKeys,
    pinnedTurnKeys,
  });

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 800 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    container.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        right: 800,
        bottom: 800,
        left: 0,
        width: 800,
        height: 800,
        toJSON: () => ({}),
      }) as DOMRect;

    Array.from(container.querySelectorAll<HTMLElement>('[data-turn-key]')).forEach(
      (element, index) => {
        element.getBoundingClientRect = () => {
          const top = index * 100 - container.scrollTop;
          return {
            x: 0,
            y: top,
            top,
            right: 800,
            bottom: top + 100,
            left: 0,
            width: 800,
            height: 100,
            toJSON: () => ({}),
          } as DOMRect;
        };
        reportTurnHeight(turnKeys[index], 100);
      },
    );
  }, [reportTurnHeight, turnKeys]);

  return (
    <div ref={scrollRef} data-testid="window-container">
      {turnKeys.map((key) => {
        const mounted = isTurnMounted(key);
        const height = measuredHeight(key);

        return (
          <div
            key={key}
            data-turn-key={key}
            data-heavy={mounted ? 'true' : 'false'}
            style={!mounted && height !== null ? { height } : undefined}
          />
        );
      })}
    </div>
  );
}

beforeEach(() => {
  resizeCallback = null;
  vi.stubGlobal('ResizeObserver', TestResizeObserver);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) =>
    window.setTimeout(() => callback(0), 0),
  );
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    window.clearTimeout(id);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Turn windowing', () => {
  it('keeps 500 Turn anchors while bounding Heavy DOM to viewport overscan and pins', () => {
    const turnHeight = 240;
    const turns = Array.from({ length: 500 }, (_, index) => turnModel(index + 1));
    const layout: TurnWindowLayoutEntry[] = turns.map((turn, index) => ({
      key: turn.key,
      top: index * turnHeight,
      bottom: (index + 1) * turnHeight,
      measured: true,
    }));
    const pinned = new Set(['turn:turn-1', 'turn:turn-500']);

    const mounted = selectMountedTurnKeys(layout, 60_000, 1_000, pinned);

    expect(mounted.size).toBeLessThan(25);
    expect(mounted.has('turn:turn-1')).toBe(true);
    expect(mounted.has('turn:turn-500')).toBe(true);

    const { container } = render(
      <>
        {turns.map((turn) => (
          <TurnItem
            key={turn.key}
            turn={turn}
            mounted={mounted.has(turn.key)}
            placeholderHeight={turnHeight}
          />
        ))}
      </>,
    );

    expect(container.querySelectorAll('[data-turn-key]')).toHaveLength(500);
    expect(container.querySelectorAll('[data-turn-window="mounted"]')).toHaveLength(mounted.size);
    expect(container.querySelectorAll('[data-turn-window="placeholder"]')).toHaveLength(
      500 - mounted.size,
    );
    expect(container.querySelectorAll('[data-testid="user-message-bubble"]')).toHaveLength(
      mounted.size,
    );

    const placeholder = container.querySelector<HTMLElement>('[data-turn-window="placeholder"]');
    expect(placeholder?.style.height).toBe('240px');
    expect(placeholder?.getAttribute('data-turn-id')).toBeTruthy();
    expect(placeholder?.tabIndex).toBe(-1);
  });

  it('runs the 500 Turn lifecycle without unbounding Heavy DOM after scroll or resize', async () => {
    render(
      <WindowingHarness
        count={500}
        pinnedTurnKeys={['turn:turn-1', 'turn:turn-500']}
      />,
    );

    const container = screen.getByTestId('window-container');

    await waitFor(() => {
      expect(container.querySelectorAll('[data-turn-key]')).toHaveLength(500);
      expect(container.querySelectorAll('[data-heavy="true"]').length).toBeLessThan(30);
    });

    expect(
      container.querySelector<HTMLElement>('[data-turn-key="turn:turn-1"]')?.dataset.heavy,
    ).toBe('true');
    expect(
      container.querySelector<HTMLElement>('[data-turn-key="turn:turn-500"]')?.dataset.heavy,
    ).toBe('true');

    act(() => {
      container.scrollTop = 25_000;
      container.dispatchEvent(new Event('scroll'));
    });

    await waitFor(() => {
      expect(container.querySelectorAll('[data-heavy="true"]').length).toBeLessThan(30);
      expect(
        container.querySelector<HTMLElement>('[data-turn-key="turn:turn-251"]')?.dataset.heavy,
      ).toBe('true');
    });

    const heavyBeforeResize = container.querySelectorAll('[data-heavy="true"]').length;

    act(() => {
      resizeCallback?.([], {} as ResizeObserver);
    });

    await waitFor(() => {
      expect(container.querySelectorAll('[data-heavy="true"]').length).toBeLessThan(30);
    });
    expect(container.querySelectorAll('[data-heavy="true"]').length).toBeLessThanOrEqual(
      heavyBeforeResize + 2,
    );
  });

  it('keeps unmeasured and explicitly pinned Turns mounted', () => {
    const layout: TurnWindowLayoutEntry[] = [
      { key: 'turn:a', top: 0, bottom: 200, measured: true },
      { key: 'turn:b', top: 10_000, bottom: 10_200, measured: false },
      { key: 'turn:c', top: 20_000, bottom: 20_200, measured: true },
    ];

    const mounted = selectMountedTurnKeys(layout, 0, 800, new Set(['turn:c']));

    expect([...mounted]).toEqual(['turn:a', 'turn:b', 'turn:c']);
  });
});
