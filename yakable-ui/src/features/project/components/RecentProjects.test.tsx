import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectsProvider } from '../context/ProjectsProvider';
import { useProjects } from '../hooks/useProjects';
import { RecentProjects } from './RecentProjects';

afterEach(() => {
  vi.unstubAllGlobals();
});

function apiResponse(data: unknown) {
  return new Response(
    JSON.stringify({ code: 0, message: 'Success', data }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function project(index: number) {
  return {
    id: `project-${index}`,
    name: `Project ${index}`,
    latestSessionId: `session-${index}`,
    updatedAt: new Date(Date.UTC(2026, 8, 30 - index)).toISOString(),
  };
}

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
  it('shows twenty skeleton rows while the first page is loading', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise<Response>(() => undefined)),
    );

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ProjectsProvider>
          <RecentProjects />
        </ProjectsProvider>
      </MemoryRouter>,
    );

    const skeleton = screen.getByTestId('recent-projects-skeleton');
    const rows = Array.from(skeleton.children);

    expect(screen.getByRole('status').textContent).toContain(
      'Loading recent projects',
    );
    expect(skeleton.className).toContain('gap-0.5');
    expect(rows).toHaveLength(20);

    rows.forEach((row) => {
      expect(row.className).toContain('h-8');
      expect(row.className).toContain('px-2');
      expect(row.firstElementChild?.className).toContain('h-3');
    });

    expect(screen.queryByText('Loading...')).toBeNull();
  });

  it('loads twenty projects first and appends the next page when the sentinel becomes visible', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => project(index + 1));
    const secondPage = Array.from(
      { length: 20 },
      (_, index) => project(index + 21),
    );
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('current=2')) {
        return apiResponse({
          records: secondPage,
          total: 40,
          pages: 2,
          current: 2,
          pageSize: 20,
        });
      }

      return apiResponse({
        records: firstPage,
        total: 40,
        pages: 2,
        current: 1,
        pageSize: 20,
      });
    });

    let intersectionCallback: IntersectionObserverCallback | null = null;
    const observe = vi.fn();
    const disconnect = vi.fn();

    class IntersectionObserverMock {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }

      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      takeRecords = () => [];
      root = null;
      rootMargin = '0px';
      thresholds = [0];
    }

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);

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
    expect(screen.getAllByRole('link')).toHaveLength(20);
    expect(
      screen.getByRole('link', { name: 'Project 5' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects?current=1&pageSize=20',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(observe).toHaveBeenCalledWith(
      screen.getByTestId('recent-projects-load-more'),
    );

    await act(async () => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/projects?current=2&pageSize=20',
        expect.anything(),
      );
    });

    expect(await screen.findByRole('link', { name: 'Project 40' })).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(40);
    expect(
      screen.queryByTestId('recent-projects-load-more'),
    ).toBeNull();
    expect(disconnect).toHaveBeenCalled();
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
