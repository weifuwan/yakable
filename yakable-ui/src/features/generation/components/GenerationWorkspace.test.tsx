import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GenerationWorkspace } from './GenerationWorkspace';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GenerationWorkspace', () => {
  it('starts the project generation run and renders backend-owned step states', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'run-123',
        projectId: 'project-123',
        status: 'RUNNING',
        steps: [
          { key: 'PREPARING', status: 'RUNNING' },
          { key: 'PLANNING', status: 'PENDING' },
          { key: 'GENERATING', status: 'PENDING' },
          { key: 'APPLYING', status: 'PENDING' },
        ],
        startedAt: '2026-09-19T00:00:00Z',
        updatedAt: '2026-09-19T00:00:00Z',
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <GenerationWorkspace
        projectId="project-123"
        projectName="CRM dashboard"
        prompt="Build a CRM dashboard"
        provider="deepseek"
        model="deepseek"
      />,
    );

    expect(screen.getByText('Build a CRM dashboard')).toBeTruthy();
    expect(await screen.findByText('Preparing project')).toBeTruthy();
    expect(screen.getByText('Planning changes')).toBeTruthy();
    expect(screen.getByText('Generating files')).toBeTruthy();
    expect(screen.getByText('Applying changes')).toBeTruthy();
    expect(screen.getAllByText('Running').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pending')).toHaveLength(3);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/project-123/generation',
      expect.objectContaining({
        method: 'PUT',
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
