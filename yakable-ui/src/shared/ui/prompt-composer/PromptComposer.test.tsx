import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PromptComposer } from './PromptComposer';

describe('PromptComposer', () => {
  it('exposes the send tooltip used by the submit affordance', () => {
    render(
      <PromptComposer
        onSubmit={() => false}
        submitTooltip="Send prompt"
      />,
    );

    expect(screen.getByRole('tooltip').textContent).toContain('Send prompt');
  });

  it('enables submit only when the prompt contains non-whitespace text', () => {
    render(<PromptComposer onSubmit={() => false} />);

    const input = screen.getByRole('textbox', { name: 'Prompt' });
    const submitButton = screen.getByRole('button', { name: 'Submit prompt' });

    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: '   ' } });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'Build a CRM dashboard' } });
    expect((submitButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('supports a controlled draft value', () => {
    const onValueChange = vi.fn();

    render(
      <PromptComposer
        value="Edit this prompt"
        onValueChange={onValueChange}
        onSubmit={() => false}
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Prompt' });
    expect((input as HTMLTextAreaElement).value).toBe('Edit this prompt');

    fireEvent.change(input, { target: { value: 'Edited prompt' } });
    expect(onValueChange).toHaveBeenCalledWith('Edited prompt');
  });

  it('submits with Enter and clears an accepted prompt', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<PromptComposer onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox', { name: 'Prompt' });
    fireEvent.change(input, { target: { value: 'Build a CRM dashboard' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('Build a CRM dashboard');
    });
    await waitFor(() => {
      expect((input as HTMLTextAreaElement).value).toBe('');
    });
  });

  it('shows a stop button while running', () => {
    const onStop = vi.fn();

    render(
      <PromptComposer
        running
        onStop={onStop}
        onSubmit={() => false}
      />,
    );

    const stopButton = screen.getByRole('button', { name: 'Stop generating' });
    fireEvent.click(stopButton);

    expect(onStop).toHaveBeenCalledOnce();
    expect(stopButton.querySelector('span')?.className).toContain('bg-white');
    expect(
      screen.queryByRole('button', { name: 'Submit prompt' }),
    ).toBeNull();
  });

  it('keeps Shift+Enter for multiline input', () => {
    const onSubmit = vi.fn();

    render(<PromptComposer onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox', { name: 'Prompt' });
    fireEvent.change(input, { target: { value: 'Line one' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit while an IME composition is active', () => {
    const onSubmit = vi.fn();

    render(<PromptComposer onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox', { name: 'Prompt' });
    fireEvent.change(input, { target: { value: '你好' } });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the prompt when the feature rejects the submission', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);

    render(<PromptComposer onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox', { name: 'Prompt' });
    fireEvent.change(input, { target: { value: 'Keep this prompt' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce();
    });

    expect((input as HTMLTextAreaElement).value).toBe('Keep this prompt');
  });
});
