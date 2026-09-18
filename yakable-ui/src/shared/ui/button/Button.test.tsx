import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('defaults to a non-submitting button while allowing an explicit type', () => {
    const { rerender } = render(<Button>Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('button');

    rerender(<Button type="submit">Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('submit');
  });
});
