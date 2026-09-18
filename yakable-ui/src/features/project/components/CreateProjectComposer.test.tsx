import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CreateProjectComposer } from './CreateProjectComposer';

describe('CreateProjectComposer', () => {
  it('enables the create button when the prompt contains text', () => {
    render(<CreateProjectComposer />);

    const input = screen.getByRole('textbox', {
      name: 'Describe the project you want to build',
    });
    const submitButton = screen.getByRole('button', { name: 'Create project' });

    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'Build a CRM dashboard' } });

    expect((submitButton as HTMLButtonElement).disabled).toBe(false);
  });
});
