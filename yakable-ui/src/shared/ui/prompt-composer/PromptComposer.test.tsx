import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PromptComposer } from './PromptComposer';

describe('PromptComposer', () => {
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
