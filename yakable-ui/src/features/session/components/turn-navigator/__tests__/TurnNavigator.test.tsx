import type { ComponentProps } from 'react';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionTurnNavigationItem } from '@/service/session';

import { TurnNavigator } from '../TurnNavigator';

const scrollIntoViewMock = vi.fn();

const items: SessionTurnNavigationItem[] = Array.from({ length: 8 }, (_, index) => ({
  turnId: 'turn-' + (index + 1),
  userMessageId: 'message-' + (index * 2 + 1),
  userMessageSequence: index * 2 + 1,
  preview: 'Prompt ' + (index + 1),
}));

function renderNavigator(overrides: Partial<ComponentProps<typeof TurnNavigator>> = {}) {
  const props: ComponentProps<typeof TurnNavigator> = {
    items,
    currentTurnId: 'turn-4',
    isJumping: false,
    onJumpTurn: vi.fn(),
    ...overrides,
  };

  return {
    props,
    ...render(<TurnNavigator {...props} />),
  };
}

beforeEach(() => {
  scrollIntoViewMock.mockClear();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoViewMock,
  });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TurnNavigator', () => {
  it('does not render before the Session has three formal Turns', () => {
    renderNavigator({ items: items.slice(0, 2) });
    expect(screen.queryByRole('complementary', { name: 'Turn navigator' })).toBeNull();
  });

  it('keeps Compact Rail markers one-to-one with Prompt Overview items', () => {
    renderNavigator();

    const rail = screen.getByRole('button', { name: 'Browse conversation turns' });
    const markers = screen.getAllByTestId('turn-navigator-marker');

    expect(rail.getAttribute('aria-expanded')).toBe('false');
    expect(markers).toHaveLength(items.length);
    expect(markers.map((marker) => marker.getAttribute('data-nav-marker-turn-id'))).toEqual(
      items.map((item) => item.turnId),
    );
    expect(screen.queryByRole('navigation', { name: 'Conversation prompts' })).toBeNull();

    fireEvent.pointerEnter(rail);

    expect(screen.getAllByRole('button', { name: /Go to turn/ })).toHaveLength(items.length);
  });

  it('opens one Prompt Overview on hover and marks the Current Prompt row', () => {
    renderNavigator();

    const rail = screen.getByRole('button', { name: 'Browse conversation turns' });
    fireEvent.pointerEnter(rail);

    const overview = screen.getByRole('navigation', { name: 'Conversation prompts' });
    const current = screen.getByRole('button', { name: 'Go to turn 4: Prompt 4' });

    expect(rail.getAttribute('aria-expanded')).toBe('true');
    expect(overview).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Go to turn/ })).toHaveLength(items.length);
    expect(current.getAttribute('aria-current')).toBe('true');
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it('stops Current auto-follow after the user starts operating the Overview', async () => {
    const { rerender, props } = renderNavigator();

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Browse conversation turns' }));

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
    scrollIntoViewMock.mockClear();

    fireEvent.pointerMove(screen.getByRole('button', { name: 'Go to turn 2: Prompt 2' }));
    rerender(<TurnNavigator {...props} currentTurnId="turn-5" />);

    const nextCurrent = screen.getByRole('button', { name: 'Go to turn 5: Prompt 5' });
    expect(nextCurrent.getAttribute('aria-current')).toBe('true');
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('keeps Prompt rows interactive while an earlier Jump is pending', async () => {
    const user = userEvent.setup();
    const onJumpTurn = vi.fn();

    renderNavigator({ isJumping: true, onJumpTurn });

    const rail = screen.getByRole('button', { name: 'Browse conversation turns' });
    fireEvent.pointerEnter(rail);

    expect(
      screen.getByRole('complementary', { name: 'Turn navigator' }).getAttribute('aria-busy'),
    ).toBe('true');

    const first = screen.getByRole('button', { name: 'Go to turn 1: Prompt 1' });
    expect(first.hasAttribute('disabled')).toBe(false);

    await user.click(first);
    expect(onJumpTurn).toHaveBeenCalledWith(items[0], { focusTarget: false });
  });

  it('moves roving Prompt focus with Arrow Home and End, then keyboard-activates the Turn', async () => {
    const user = userEvent.setup();
    const onJumpTurn = vi.fn();

    renderNavigator({ onJumpTurn });

    await user.tab();

    const rail = screen.getByRole('button', { name: 'Browse conversation turns' });
    expect(document.activeElement).toBe(rail);

    const current = screen.getByRole('button', { name: 'Go to turn 4: Prompt 4' });
    await user.tab();
    expect(document.activeElement).toBe(current);

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Go to turn 5: Prompt 5' }),
    );

    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Go to turn 1: Prompt 1' }),
    );

    await user.keyboard('{End}');
    const last = screen.getByRole('button', { name: 'Go to turn 8: Prompt 8' });
    expect(document.activeElement).toBe(last);

    await user.keyboard('{Enter}');
    expect(onJumpTurn).toHaveBeenCalledWith(items[7], { focusTarget: true });
  });

  it('opens the Overview and focuses Current Prompt with Shift Alt M', async () => {
    renderNavigator();

    fireEvent.keyDown(window, {
      key: 'm',
      altKey: true,
      shiftKey: true,
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Go to turn 4: Prompt 4' }),
      );
    });
    expect(screen.getByRole('navigation', { name: 'Conversation prompts' })).toBeTruthy();
  });

  it('closes the Overview with Escape and returns focus to the Compact Rail', async () => {
    const user = userEvent.setup();

    renderNavigator();

    fireEvent.keyDown(window, {
      key: 'm',
      altKey: true,
      shiftKey: true,
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Go to turn 4: Prompt 4' }),
      );
    });

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('navigation', { name: 'Conversation prompts' })).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Browse conversation turns' }),
    );
  });

  it('keeps the Overview open while the pointer crosses from Rail to Panel', () => {
    vi.useFakeTimers();

    renderNavigator();

    const rail = screen.getByRole('button', { name: 'Browse conversation turns' });
    fireEvent.pointerEnter(rail);

    const overview = screen.getByRole('navigation', { name: 'Conversation prompts' });
    fireEvent.pointerLeave(rail);
    fireEvent.pointerEnter(overview);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByRole('navigation', { name: 'Conversation prompts' })).toBeTruthy();

    fireEvent.pointerLeave(overview);
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByRole('navigation', { name: 'Conversation prompts' })).toBeNull();
  });
});
