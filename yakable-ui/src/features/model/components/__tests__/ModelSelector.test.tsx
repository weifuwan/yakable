import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ModelSelector } from '../ModelSelector';

describe('ModelSelector', () => {
  it('renders the current model through shared Select', async () => {
    const user = userEvent.setup();

    render(
      <ModelSelector
        value={{
          provider: 'deepseek',
          model: 'deepseek-flash',
        }}
        onValueChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Select model' });

    expect(trigger.textContent).toContain('DeepSeek');

    await user.click(trigger);

    expect(
      screen
        .getByRole('menuitemradio', { name: 'DeepSeek' })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('maps Select values back to ModelSelection', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <ModelSelector
        value={{
          provider: 'deepseek',
          model: 'deepseek-flash',
        }}
        onValueChange={onValueChange}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Select model' }),
    );
    await user.click(
      screen.getByRole('menuitemradio', { name: 'Kimi' }),
    );

    expect(onValueChange).toHaveBeenCalledWith({
      provider: 'kimi',
      model: 'kimi-k3',
    });
  });
});
