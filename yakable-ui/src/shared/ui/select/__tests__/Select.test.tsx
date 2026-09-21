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

    const trigger = screen.getByRole('combobox');
    expect(trigger.textContent).toContain('Build');

    await user.click(trigger);

    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(
      screen
        .getByRole('option', {
          name: 'Build Make changes directly',
        })
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(
      screen.getByText('Detailed spec for complex builds'),
    ).toBeTruthy();
    expect(screen.getByText('Switch modes with Alt P')).toBeTruthy();
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

    const trigger = screen.getByRole('combobox');

    await user.click(trigger);
    await user.click(
      screen.getByRole('option', {
        name: 'Plan Detailed spec for complex builds',
      }),
    );

    expect(onValueChange).toHaveBeenCalledWith('plan');
    expect(trigger.textContent).toContain('Plan');
    expect(screen.queryByRole('listbox')).toBeNull();
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

    const trigger = screen.getByRole('combobox');
    trigger.focus();

    await user.keyboard('{ArrowDown}');

    const buildOption = await screen.findByRole('option', {
      name: 'Build Make changes directly',
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(buildOption);
    });

    await user.keyboard('{ArrowDown}');
    const planOption = screen.getByRole('option', {
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

    const trigger = screen.getByRole('combobox');
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

    const trigger = screen.getByRole('combobox');

    await user.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });
});
