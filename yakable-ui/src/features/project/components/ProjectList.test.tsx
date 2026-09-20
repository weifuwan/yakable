import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectsProvider } from '../context/ProjectsProvider';
import { ProjectList } from './ProjectList';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProjectList', () => {
  it('loads projects from ProjectService and renders the empty state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          message: 'Success',
          data: {
            records: [],
            total: 0,
            pages: 0,
            current: 1,
            pageSize: 50,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <ProjectsProvider>
          <ProjectList />
        </ProjectsProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'No projects yet' }),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects?current=1&pageSize=50',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
