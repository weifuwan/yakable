import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ModelSelector } from './ModelSelector';

describe('ModelSelector', () => {
  it('opens the model list and reports the selected model', () => {
    const onValueChange = vi.fn();

    render(
      <ModelSelector
        value={{ provider: 'deepseek', model: 'deepseek-flash' }}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select model' }));

    expect(screen.getByRole('listbox', { name: 'Models' })).toBeTruthy();

    fireEvent.click(screen.getByRole('option', { name: 'Kimi' }));

    expect(onValueChange).toHaveBeenCalledWith({
      provider: 'kimi',
      model: 'kimi-k3',
    });
  });
});
