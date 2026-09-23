import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SessionMessage } from '@/service/session';

import { TurnItem, type TurnRenderModel } from '../../components/TurnItem';
import {
  selectMountedTurnKeys,
  type TurnWindowLayoutEntry,
} from '../useTurnWindowing';

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

    const placeholder = container.querySelector<HTMLElement>(
      '[data-turn-window="placeholder"]',
    );
    expect(placeholder?.style.height).toBe('240px');
    expect(placeholder?.getAttribute('data-turn-id')).toBeTruthy();
    expect(placeholder?.tabIndex).toBe(-1);
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
