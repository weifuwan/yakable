import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProjectFilesTree } from '../ProjectFilesTree';

describe('ProjectFilesTree', () => {
  it('renders nested relative paths and selects the full file path', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <ProjectFilesTree
        files={['package.json', 'src/App.tsx', 'src/components/Button.tsx']}
        selectedPath="src/App.tsx"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText('src')).toBeTruthy();
    expect(screen.getByText('components')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'App.tsx' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'Button.tsx' }));

    expect(onSelect).toHaveBeenCalledWith('src/components/Button.tsx');
  });
});
