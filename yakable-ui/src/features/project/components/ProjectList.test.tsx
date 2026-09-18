import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ProjectList } from './ProjectList';

describe('ProjectList', () => {
  it('loads projects from the project API and renders the empty state', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <ProjectList />
      </MemoryRouter>,
    );

    expect(await screen.findByText('No projects yet')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );

    vi.unstubAllGlobals();
  });
});
