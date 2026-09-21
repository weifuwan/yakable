import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    render(
      <MessageItem
        message={userMessage}
        onRegenerate={() => undefined}
      />,
    );

    const actions = screen.getByTestId('user-message-actions');
    const bubble = screen.getByTestId('user-message-bubble');

    expect(bubble.className).toContain('rounded-[22px]');
    expect(bubble.className).toContain('rounded-br-md');
    expect(bubble.className).toContain('border-[#E1E1E0]');
    expect(bubble.className).toContain('bg-white');

    expect(actions.className).toContain('absolute');
    expect(actions.className).toContain('top-full');
    expect(actions.className).toContain('items-center');
    expect(actions.className).toContain('h-7');
    expect(actions.className).toContain('pt-1');
    expect(actions.className).not.toContain('mt-1');
    expect(actions.className).toContain('opacity-0');
    expect(actions.className).toContain('group-hover:opacity-100');
    const copyButton = screen.getByRole('button', { name: 'Copy message' });
    const editButton = screen.getByRole('button', { name: 'Edit message' });
    const timestamp = screen.getByText('Sep 20 at 9:52 AM');

    expect(copyButton.className).toContain('size-6');
    expect(editButton.className).toContain('size-6');
    expect(copyButton.className).toContain('cursor-pointer');
    expect(editButton.className).toContain('cursor-pointer');
    expect(copyButton.className).toContain('text-[#858585]');
    expect(editButton.className).toContain('text-[#858585]');
    expect(timestamp.className).toContain('text-[13px]');
    expect(timestamp.className).toContain('text-[#858585]');
  });

  it('shows copied feedback after copying the user message content', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<MessageItem message={userMessage} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));

    expect(writeText).toHaveBeenCalledWith('Build a membership system');
    expect((await screen.findByRole('status')).textContent).toBe('Copied');

    const copyIcon = screen.getByTestId('copy-message-icon');
    expect(copyIcon.getAttribute('data-copied')).toBe('true');

    const icons = copyIcon.querySelectorAll('svg');
    expect(icons).toHaveLength(2);
    expect(icons[0]?.getAttribute('class')).toContain('opacity-0');
    expect(icons[1]?.getAttribute('class')).toContain('opacity-100');
    expect(icons[1]?.getAttribute('class')).toContain('text-[#4F7F37]');
    expect(icons[1]?.querySelector('circle')).toBeTruthy();
  });

  it('edits the message inline and cancels without regenerating', () => {
    const onRegenerate = vi.fn();

    render(
      <MessageItem
        message={userMessage}
        onRegenerate={onRegenerate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));

    const input = screen.getByRole('textbox', {
      name: 'Edit user message',
    }) as HTMLTextAreaElement;

    expect(input.value).toBe('Build a membership system');
    const messageRoot = screen.getByLabelText('Assistant message');
    const content = screen.getByTestId('assistant-message-content');

    expect(messageRoot.className).toContain('w-full');
    expect(content.className).toContain('w-full');
    expect(content.className).toContain('min-w-0');
    expect(content.className).not.toContain('max-w-[78%]');

    expect(screen.queryByTestId('user-message-actions')).toBeNull();

    fireEvent.change(input, {
      target: { value: 'Build a better membership system' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onRegenerate).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('textbox', { name: 'Edit user message' }),
    ).toBeNull();
    expect(screen.getByText('Build a membership system')).toBeTruthy();
  });

  it('regenerates from the edited content', async () => {
    const onRegenerate = vi.fn().mockResolvedValue(true);

    render(
      <MessageItem
        message={userMessage}
        onRegenerate={onRegenerate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));

    const input = screen.getByRole('textbox', {
      name: 'Edit user message',
    });
    fireEvent.change(input, {
      target: { value: 'Build a better membership system' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(onRegenerate).toHaveBeenCalledWith(
        userMessage,
        'Build a better membership system',
      );
    });
    await waitFor(() => {
      expect(
        screen.queryByRole('textbox', { name: 'Edit user message' }),
      ).toBeNull();
    });
  });

  it('keeps the inline editor open when regeneration is rejected', async () => {
    const onRegenerate = vi.fn().mockResolvedValue(false);

    render(
      <MessageItem
        message={userMessage}
        onRegenerate={onRegenerate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(onRegenerate).toHaveBeenCalledOnce();
    });
    expect(
      screen.getByRole('textbox', { name: 'Edit user message' }),
    ).toBeTruthy();
  });

  it('uses the full conversation width for assistant messages', () => {
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
