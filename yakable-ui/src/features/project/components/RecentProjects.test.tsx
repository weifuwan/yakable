import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectsProvider } from '../context/ProjectsProvider';
import { useProjects } from '../hooks/useProjects';
import { RecentProjects } from './RecentProjects';

afterEach(() => {
  vi.unstubAllGlobals();
});

function UpsertProjectButton() {
  const { upsertProject } = useProjects();

  return (
    <button
      type="button"
      onClick={() =>
        upsertProject({
          id: 'project-created',
          name: 'Created project',
          latestSessionId: 'session-created',
          updatedAt: '2026-09-19T12:00:00Z',
        })
      }
    >
      Upsert project
    </button>
  );
}

describe('RecentProjects', () => {
  it('shows the five most recently updated projects and marks the project route active', async () => {
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
          '/dashboard/project/project-5/session/older-session',
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

  it('shows an upserted project after the initial project list request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Project list unavailable')),
    );

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ProjectsProvider>
          <RecentProjects />
          <UpsertProjectButton />
        </ProjectsProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText('Recent projects unavailable'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Upsert project' }));

    expect(
      screen.getByRole('link', { name: 'Created project' }),
    ).toBeTruthy();
    expect(screen.queryByText('Recent projects unavailable')).toBeNull();
  });
});
