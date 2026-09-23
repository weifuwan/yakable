import type { ComponentProps } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

function renderNavigator(overrides: Partial<ComponentProps<typeof TurnNavigator>> = {}) {
  const props: ComponentProps<typeof TurnNavigator> = {
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

function setRect(element: HTMLElement, top: number, height: number) {
  element.getBoundingClientRect = () =>
    ({
      x: 0,
      y: top,
      top,
      right: 40,
      bottom: top + height,
      left: 0,
      width: 40,
      height,
      toJSON: () => ({}),
    }) as DOMRect;
}

function configureRailGeometry() {
  const rail = screen.getByTestId('turn-navigator-rail');
  Object.defineProperties(rail, {
    scrollTop: { configurable: true, writable: true, value: 0 },
    clientHeight: { configurable: true, value: 48 },
  });
  setRect(rail, 100, 48);

  items.forEach((_, index) => {
    setRect(
      screen.getByRole('button', { name: 'Go to turn ' + (index + 1) }),
      100 + index * 16,
      16,
    );
  });

  return rail;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TurnNavigator', () => {
  it('does not render before the Session has three formal Turns', () => {
    renderNavigator({ items: items.slice(0, 2) });
    expect(screen.queryByRole('complementary', { name: 'Turn navigator' })).toBeNull();
  });

  it('marks Current and keeps one roving rib in the tab order', () => {
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

  it('routes pointer navigation without requesting target focus', async () => {
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

    expect(onJumpTurn).toHaveBeenCalledWith(items[2], { focusTarget: false });
    expect(onPrevious).toHaveBeenCalledWith({ focusTarget: false });
    expect(onNext).toHaveBeenCalledWith({ focusTarget: false });
    expect(onOrigin).toHaveBeenCalledWith({ focusTarget: false });
    expect(onTerminus).toHaveBeenCalledWith({ focusTarget: false });
  });

  it('moves roving focus with Arrow Home and End, then keyboard-activates the Turn', async () => {
    const user = userEvent.setup();
    const onJumpTurn = vi.fn();

    renderNavigator({ onJumpTurn });

    const current = screen.getByRole('button', { name: 'Go to turn 2' });
    const third = screen.getByRole('button', { name: 'Go to turn 3' });
    const first = screen.getByRole('button', { name: 'Go to turn 1' });

    current.focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(third);
    expect(third.tabIndex).toBe(0);
    expect(current.tabIndex).toBe(-1);

    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(first);

    await user.keyboard('{End}');
    expect(document.activeElement).toBe(third);

    await user.keyboard('{Enter}');
    expect(onJumpTurn).toHaveBeenCalledWith(items[2], { focusTarget: true });
  });

  it('returns focus to the Current rib with Shift Alt M', () => {
    renderNavigator();

    const latest = screen.getByRole('button', { name: 'Go to latest' });
    const current = screen.getByRole('button', { name: 'Go to turn 2' });

    latest.focus();
    fireEvent.keyDown(window, {
      key: 'm',
      altKey: true,
      shiftKey: true,
    });

    expect(document.activeElement).toBe(current);
  });

  it('waits for drag release before jumping and suppresses the synthetic click', () => {
    const onJumpTurn = vi.fn();
    const onPreviewTurnChange = vi.fn();

    renderNavigator({ onJumpTurn, onPreviewTurnChange });
    const rail = configureRailGeometry();
    const first = screen.getByRole('button', { name: 'Go to turn 1' });

    fireEvent.pointerDown(first, {
      pointerId: 7,
      clientX: 10,
      clientY: 108,
    });
    fireEvent.pointerMove(rail, {
      pointerId: 7,
      clientX: 10,
      clientY: 110,
    });
    expect(onJumpTurn).not.toHaveBeenCalled();

    fireEvent.pointerMove(rail, {
      pointerId: 7,
      clientX: 10,
      clientY: 140,
    });
    expect(onPreviewTurnChange).toHaveBeenCalledWith('turn-3');
    expect(onJumpTurn).not.toHaveBeenCalled();

    fireEvent.pointerUp(rail, {
      pointerId: 7,
      clientX: 10,
      clientY: 140,
    });

    expect(onJumpTurn).toHaveBeenCalledTimes(1);
    expect(onJumpTurn).toHaveBeenCalledWith(items[2], { focusTarget: false });

    fireEvent.click(first);
    expect(onJumpTurn).toHaveBeenCalledTimes(1);
  });

  it('cancels an active Drag without jumping', () => {
    const onJumpTurn = vi.fn();
    const onPreviewTurnChange = vi.fn();

    renderNavigator({ onJumpTurn, onPreviewTurnChange });
    const rail = configureRailGeometry();
    const first = screen.getByRole('button', { name: 'Go to turn 1' });

    fireEvent.pointerDown(first, {
      pointerId: 9,
      clientX: 10,
      clientY: 108,
    });
    fireEvent.pointerMove(rail, {
      pointerId: 9,
      clientX: 10,
      clientY: 140,
    });
    fireEvent.pointerCancel(rail, {
      pointerId: 9,
      clientX: 10,
      clientY: 140,
    });

    expect(onJumpTurn).not.toHaveBeenCalled();
    expect(onPreviewTurnChange).toHaveBeenLastCalledWith(null);
  });

  it('applies Fisheye as transform-only visual scaling and resets on leave', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    renderNavigator();
    const rail = configureRailGeometry();
    const secondVisual = screen
      .getByRole('button', { name: 'Go to turn 2' })
      .querySelector<HTMLElement>('[data-rib-visual]');

    expect(secondVisual).toBeTruthy();

    fireEvent.pointerEnter(rail);
    fireEvent.pointerMove(rail, {
      pointerId: 3,
      clientX: 10,
      clientY: 124,
    });

    expect(secondVisual?.style.transform).not.toBe('scaleX(1)');

    fireEvent.pointerLeave(rail);
    expect(secondVisual?.style.transform).toBe('scaleX(1)');
  });
});
