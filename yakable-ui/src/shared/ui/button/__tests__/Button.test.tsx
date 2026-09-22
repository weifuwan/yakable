import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button, buttonVariants } from '../Button';

describe('Button', () => {
  it('uses the secondary md contract by default', () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });

    expect(button.getAttribute('type')).toBe('button');
    expect(button.className).toContain('border-border-control');
    expect(button.className).toContain('bg-surface');
    expect(button.className).toContain('h-9');
    expect(button.className).toContain('px-3.5');
  });

  it('applies explicit variant and size contracts', () => {
    render(
      <Button variant="primary" size="sm">
        Create
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Create' });

    expect(button.className).toContain('bg-primary');
    expect(button.className).toContain('text-primary-foreground');
    expect(button.className).toContain('h-7');
    expect(button.className).toContain('px-2.5');
  });

  it('supports compact circular accent actions', () => {
    const classes = buttonVariants({
      variant: 'accent',
      size: 'icon-sm',
      shape: 'circle',
    });

    expect(classes).toContain('bg-action-active');
    expect(classes).toContain('size-8');
    expect(classes).toContain('rounded-full');
  });

  it('owns the primary disabled visual state', () => {
    const classes = buttonVariants({
      variant: 'primary',
      size: 'icon-sm',
      shape: 'circle',
    });

    expect(classes).toContain('disabled:bg-surface-skeleton');
    expect(classes).toContain('disabled:text-foreground-disabled');
  });

  it('keeps caller classes as an escape hatch', () => {
    render(<Button className="w-full">Continue</Button>);

    expect(screen.getByRole('button', { name: 'Continue' }).className).toContain('w-full');
  });

  it('renders through Slot when asChild is enabled', () => {
    render(
      <Button asChild variant="link">
        <a href="/docs">Docs</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'Docs' });

    expect(link.getAttribute('href')).toBe('/docs');
    expect(link.className).toContain('hover:underline');
    expect(screen.queryByRole('button', { name: 'Docs' })).toBeNull();
  });

  it('exposes destructive and icon contracts through buttonVariants', () => {
    const classes = buttonVariants({
      variant: 'destructive',
      size: 'icon',
    });

    expect(classes).toContain('bg-danger');
    expect(classes).toContain('size-9');
  });
});
