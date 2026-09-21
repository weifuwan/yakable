import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PromptComposer } from '../PromptComposer';

describe('PromptComposer', () => {
  it('submits with Enter and clears an accepted prompt', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(true);

    render(<PromptComposer onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox', { name: 'Prompt' });
    await user.type(input, '  Build a CRM dashboard  ');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('Build a CRM dashboard');
    });
    await waitFor(() => {
      expect((input as HTMLTextAreaElement).value).toBe('');
    });
  });

  it('keeps Shift+Enter as multiline input instead of submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PromptComposer onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox', { name: 'Prompt' });
    await user.type(input, 'Line one');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit while IME composition is active', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PromptComposer onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox', { name: 'Prompt' });
    await user.type(input, '你好');

    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the prompt when the feature rejects submission', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(false);

    render(<PromptComposer onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox', { name: 'Prompt' });
    await user.type(input, 'Keep this prompt');
    await user.click(
      screen.getByRole('button', { name: 'Submit prompt' }),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('Keep this prompt');
    });
    expect((input as HTMLTextAreaElement).value).toBe('Keep this prompt');
  });

  it('exposes Stop while running and invokes the stop action', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();

    render(
      <PromptComposer
        running
        onStop={onStop}
        onSubmit={() => true}
      />,
    );

    const stopButton = screen.getByRole('button', {
      name: 'Stop generating',
    });

    await user.click(stopButton);

    expect(onStop).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('button', { name: 'Submit prompt' }),
    ).toBeNull();
  });
});
