import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Select } from '../Select';

const options = [
  {
    value: 'build',
    label: 'Build',
    description: 'Make changes directly',
  },
  {
    value: 'plan',
    label: 'Plan',
    description: 'Detailed spec for complex builds',
  },
] as const;

describe('Select', () => {
  it('renders the selected option and reference-style menu content', async () => {
    const user = userEvent.setup();

    render(
      <Select
        defaultValue="build"
        options={options}
        footer={<span>Switch modes with Alt P</span>}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Build/ });
    expect(trigger.textContent).toContain('Build');

    await user.click(trigger);

    expect(screen.getByRole('menu')).toBeTruthy();
    expect(
      screen
        .getByRole('menuitemradio', {
          name: 'Build Make changes directly',
        })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen.getByText('Detailed spec for complex builds'),
    ).toBeTruthy();
    expect(screen.getByText('Switch modes with Alt P')).toBeTruthy();
  });

  it('keeps the layered trigger chassis and engaged state contract', async () => {
    const user = userEvent.setup();

    render(<Select defaultValue="build" options={options} />);

    const trigger = screen.getByRole('button', { name: /Build/ });
    const layers = trigger.querySelectorAll('[data-fx-layer]');

    expect(trigger.getAttribute('data-surface')).toBe('chassis');
    expect(trigger.className).toContain('yak-select-trigger-chassis');
    expect(layers).toHaveLength(12);
    expect(
      trigger.querySelector('[data-fx-layer="drop-shadow"]'),
    ).toBeTruthy();
    expect(
      trigger.querySelector('[data-fx-layer="engaged-glow"]'),
    ).toBeTruthy();
    expect(trigger.hasAttribute('data-open')).toBe(false);

    await user.click(trigger);

    expect(trigger.hasAttribute('data-open')).toBe(true);
    expect(screen.getByRole('menu').className).toContain(
      'yak-select-menu',
    );
  });

  it('renders borderless surface without the layered chassis', () => {
    render(
      <Select
        defaultValue="build"
        options={options}
        surface="borderless"
      />,
    );

    const trigger = screen.getByRole('button', { name: /Build/ });

    expect(trigger.getAttribute('data-surface')).toBe('borderless');
    expect(trigger.className).toContain('yak-select-trigger-borderless');
    expect(trigger.querySelectorAll('[data-fx-layer]')).toHaveLength(0);
  });

  it('keeps selected state neutral but preserves hover feedback', async () => {
    const user = userEvent.setup();

    render(<Select defaultValue="build" options={options} />);

    await user.click(screen.getByRole('button', { name: /Build/ }));

    const selected = screen.getByRole('menuitemradio', {
      name: 'Build Make changes directly',
    });

    expect(selected.getAttribute('aria-checked')).toBe('true');
    expect(selected.className).toContain('focus:bg-transparent');
    expect(selected.className).toContain('hover:bg-surface-hover');
  });

  it('updates uncontrolled value and closes after selection', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <Select
        defaultValue="build"
        options={options}
        onValueChange={onValueChange}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Build/ });

    await user.click(trigger);
    await user.click(
      screen.getByRole('menuitemradio', {
        name: 'Plan Detailed spec for complex builds',
      }),
    );

    expect(onValueChange).toHaveBeenCalledWith('plan');
    expect(trigger.textContent).toContain('Plan');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('supports Arrow navigation and Enter selection', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <Select
        defaultValue="build"
        options={options}
        onValueChange={onValueChange}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Build/ });
    trigger.focus();

    await user.keyboard('{ArrowDown}');

    const buildOption = await screen.findByRole('menuitemradio', {
      name: 'Build Make changes directly',
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(buildOption);
    });

    await user.keyboard('{ArrowDown}');
    const planOption = screen.getByRole('menuitemradio', {
      name: 'Plan Detailed spec for complex builds',
    });
    expect(document.activeElement).toBe(planOption);

    await user.keyboard('{Enter}');

    expect(onValueChange).toHaveBeenCalledWith('plan');
    expect(trigger.textContent).toContain('Plan');
  });

  it('skips disabled options when navigating', async () => {
    const user = userEvent.setup();

    render(
      <Select
        defaultValue="build"
        options={[
          options[0],
          {
            ...options[1],
            disabled: true,
          },
          {
            value: 'review',
            label: 'Review',
            description: 'Inspect changes before applying',
          },
        ]}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Build/ });
    trigger.focus();
    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(
        document.activeElement?.getAttribute('data-value'),
      ).toBe('build');
    });

    await user.keyboard('{ArrowDown}');

    expect(document.activeElement?.getAttribute('data-value')).toBe(
      'review',
    );
  });

  it('closes on Escape and restores trigger focus', async () => {
    const user = userEvent.setup();

    render(<Select defaultValue="build" options={options} />);

    const trigger = screen.getByRole('button', { name: /Build/ });

    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });
});
