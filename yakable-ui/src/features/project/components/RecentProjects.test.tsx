import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectsProvider } from '../context/ProjectsProvider';
import { RecentProjects } from './RecentProjects';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RecentProjects', () => {
  it('shows the five most recently updated projects and marks the session route active', async () => {
    const projects = Array.from({ length: 6 }, (_, index) => ({
      id: `project-${index + 1}`,
      name: `Project ${index + 1}`,
      latestSessionId: `session-${index + 1}`,
      updatedAt: new Date(Date.UTC(2026, 8, 6 - index)).toISOString(),
    }));

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          records: projects,
          total: projects.length,
          pages: 1,
          current: 1,
          pageSize: 50,
        }),
      }),
    );

    render(
      <MemoryRouter
        initialEntries={[
          '/dashboard/project/project-5/session/session-5',
        ]}
      >
        <ProjectsProvider>
          <RecentProjects />
        </ProjectsProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: 'Project 1' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Project 6' })).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(5);
    expect(
      screen.getByRole('link', { name: 'Project 5' }).getAttribute('aria-current'),
    ).toBe('page');
  });
});
