import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectsProvider } from '../context/ProjectsProvider';
import { ProjectList } from './ProjectList';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProjectList', () => {
  it('loads projects from the project API and renders the empty state', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

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
      '/api/projects',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
