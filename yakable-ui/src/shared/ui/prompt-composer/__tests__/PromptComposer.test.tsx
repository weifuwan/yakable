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

  it('renders the layered PromptComposer surface chassis', () => {
    render(<PromptComposer onSubmit={() => true} />);

    const surface = screen.getByTestId('prompt-composer-surface');
    const halo = screen.getByTestId('prompt-composer-halo');
    const layers = surface.querySelectorAll('[data-composer-fx]');

    expect(surface.className).toContain('yak-composer-surface');
    expect(halo.className).toContain('yak-composer-halo');
    expect(layers).toHaveLength(5);
    expect(
      surface.querySelector('[data-composer-fx="drop-shadow"]'),
    ).toBeTruthy();
    expect(
      surface.querySelector('[data-composer-fx="focus-glow"]'),
    ).toBeTruthy();
  });

  it('renders submit through the shared compact circular Button contract', async () => {
    const user = userEvent.setup();

    render(<PromptComposer onSubmit={() => true} />);

    const input = screen.getByRole('textbox', { name: 'Prompt' });
    const submit = screen.getByRole('button', { name: 'Submit prompt' });

    expect(submit.className).toContain('bg-primary');
    expect(submit.className).toContain('size-8');
    expect(submit.className).toContain('rounded-full');

    await user.type(input, 'Hello');

    expect(submit.hasAttribute('disabled')).toBe(false);
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

    expect(stopButton.className).toContain('bg-action-active');
    expect(stopButton.className).toContain('size-8');
    expect(stopButton.className).toContain('rounded-full');

    await user.click(stopButton);

    expect(onStop).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('button', { name: 'Submit prompt' }),
    ).toBeNull();
  });
});
