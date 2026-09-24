import { fireEvent, render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('defaults to a non-submit button and forwards its ref', () => {
    const ref = createRef<HTMLButtonElement>();
    const { getByRole } = render(<Button ref={ref}>Save</Button>);

    const button = getByRole('button', { name: 'Save' });

    expect(button.getAttribute('type')).toBe('button');
    expect(ref.current).toBe(button);
  });

  it('does not activate while disabled', () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );

    fireEvent.click(getByRole('button', { name: 'Save' }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
