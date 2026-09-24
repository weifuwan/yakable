import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectService } from '@/service/project';

import { ProjectFilesBrowser } from '../ProjectFilesBrowser';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ProjectFilesBrowser', () => {
  it('loads file paths first and reads content only after file selection', async () => {
    const user = userEvent.setup();
    vi.spyOn(ProjectService, 'queryProjectFiles').mockResolvedValue({
      files: ['package.json', 'src/App.tsx'],
    });
    const queryProjectFile = vi.spyOn(ProjectService, 'queryProjectFile').mockResolvedValue({
      path: 'src/App.tsx',
      content: 'export default function App() {}',
    });

    render(<ProjectFilesBrowser projectId="project-1" />);

    expect(await screen.findByRole('button', { name: 'App.tsx' })).toBeTruthy();
    expect(queryProjectFile).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'App.tsx' }));

    expect(screen.getByText('src/App.tsx')).toBeTruthy();
    await waitFor(() => {
      expect(queryProjectFile).toHaveBeenCalledWith(
        'project-1',
        'src/App.tsx',
        expect.any(AbortSignal),
      );
    });
    expect(await screen.findByText('tsx')).toBeTruthy();
  });

  it('shows a neutral empty state without inferring generation status', async () => {
    vi.spyOn(ProjectService, 'queryProjectFiles').mockResolvedValue({ files: [] });

    render(<ProjectFilesBrowser projectId="project-1" />);

    expect(await screen.findByText('No published files yet.')).toBeTruthy();
    expect(screen.queryByText(/failed|running|stopped/i)).toBeNull();
  });
});
