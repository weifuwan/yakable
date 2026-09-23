import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SessionTurnNavigationItem } from '@/service/session';

import { TurnNavigator } from '../TurnNavigator';

const items: SessionTurnNavigationItem[] = [
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
    preview: 'Third prompt',
  },
];

function renderNavigator(overrides: Partial<React.ComponentProps<typeof TurnNavigator>> = {}) {
  const props: React.ComponentProps<typeof TurnNavigator> = {
    items,
    currentTurnId: 'turn-2',
    visibleTurnIds: ['turn-2', 'turn-3'],
    previewItem: null,
    isJumping: false,
    hasPrevious: true,
    hasNext: true,
    onPreviewTurnChange: vi.fn(),
    onJumpTurn: vi.fn(),
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onOrigin: vi.fn(),
    onTerminus: vi.fn(),
    ...overrides,
  };

  return {
    props,
    ...render(<TurnNavigator {...props} />),
  };
}

describe('TurnNavigator', () => {
  it('does not render before the Session has three formal Turns', () => {
    renderNavigator({ items: items.slice(0, 2) });
    expect(screen.queryByRole('complementary', { name: 'Turn navigator' })).toBeNull();
  });

  it('marks Current and keeps only the Current rib in the tab order', () => {
    renderNavigator();

    const first = screen.getByRole('button', { name: 'Go to turn 1' });
    const current = screen.getByRole('button', { name: 'Go to turn 2' });
    const third = screen.getByRole('button', { name: 'Go to turn 3' });

    expect(first.tabIndex).toBe(-1);
    expect(current.tabIndex).toBe(0);
    expect(current.getAttribute('aria-current')).toBe('true');
    expect(third.tabIndex).toBe(-1);
  });

  it('uses one shared Prompt Preview surface', async () => {
    const user = userEvent.setup();
    const onPreviewTurnChange = vi.fn();

    const { rerender, props } = renderNavigator({ onPreviewTurnChange });

    await user.hover(screen.getByRole('button', { name: 'Go to turn 1' }));
    expect(onPreviewTurnChange).toHaveBeenCalledWith('turn-1');

    rerender(<TurnNavigator {...props} previewItem={items[0]} />);

    expect(screen.getByRole('tooltip').textContent).toBe('First prompt');
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
  });

  it('routes basic navigation controls through their callbacks', async () => {
    const user = userEvent.setup();
    const onJumpTurn = vi.fn();
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const onOrigin = vi.fn();
    const onTerminus = vi.fn();

    renderNavigator({
      onJumpTurn,
      onPrevious,
      onNext,
      onOrigin,
      onTerminus,
    });

    await user.click(screen.getByRole('button', { name: 'Go to turn 3' }));
    await user.click(screen.getByRole('button', { name: 'Previous turn' }));
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await user.click(screen.getByRole('button', { name: 'Go to conversation start' }));
    await user.click(screen.getByRole('button', { name: 'Go to latest' }));

    expect(onJumpTurn).toHaveBeenCalledWith(items[2]);
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onOrigin).toHaveBeenCalledTimes(1);
    expect(onTerminus).toHaveBeenCalledTimes(1);
  });
});
