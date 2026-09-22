import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RecentProjects } from '../RecentProjects';

const projectState = vi.hoisted(() => ({
  projects: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  error: 'Unable to load projects.',
  retryInitial: vi.fn(),
  loadMore: vi.fn(),
  upsertProject: vi.fn(),
  markProjectActive: vi.fn(),
}));

vi.mock('../../hooks/useProjects', () => ({
  useProjects: () => projectState,
}));

beforeEach(() => {
  projectState.projects = [];
  projectState.isLoading = false;
  projectState.isLoadingMore = false;
  projectState.hasMore = false;
  projectState.error = 'Unable to load projects.';
  projectState.retryInitial.mockReset();
  projectState.loadMore.mockReset();
});

describe('RecentProjects', () => {
  it('offers Retry when the initial load fails', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RecentProjects />
      </MemoryRouter>,
    );

    expect(screen.getByText('Recent projects unavailable')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(projectState.retryInitial).toHaveBeenCalledOnce();
  });
});
