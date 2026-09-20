import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SessionMessage } from '@/service/session';

import { MessageItem } from './MessageItem';

const userMessage: SessionMessage = {
  id: 'message-1',
  turnId: 'turn-1',
  role: 'USER',
  content: 'Build a membership system',
  sequence: 1,
  createdAt: '2026-09-20T09:52:00',
};

describe('MessageItem', () => {
  it('shows hover actions for a user message without changing layout', () => {
    render(<MessageItem message={userMessage} onEdit={() => undefined} />);

    const actions = screen.getByTestId('user-message-actions');

    expect(actions.className).toContain('absolute');
    expect(actions.className).toContain('opacity-0');
    expect(actions.className).toContain('group-hover:opacity-100');
    expect(screen.getByRole('button', { name: 'Copy message' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit message' })).toBeTruthy();
    expect(screen.getByText('Sep 20 at 9:52 AM')).toBeTruthy();
  });

  it('copies the user message content', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<MessageItem message={userMessage} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));

    expect(writeText).toHaveBeenCalledWith('Build a membership system');
  });

  it('forwards the selected user message to the edit action', () => {
    const onEdit = vi.fn();

    render(<MessageItem message={userMessage} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));

    expect(onEdit).toHaveBeenCalledWith(userMessage);
  });

  it('does not render user actions for assistant messages', () => {
    render(
      <MessageItem
        message={{
          ...userMessage,
          id: 'message-2',
          role: 'ASSISTANT',
          content: 'Sure.',
        }}
      />,
    );

    expect(screen.queryByTestId('user-message-actions')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy message' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit message' })).toBeNull();
  });
});
