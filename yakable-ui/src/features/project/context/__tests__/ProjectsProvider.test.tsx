import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectService } from '@/service/project';

import { ProjectsProvider, useProjectsContext } from '../ProjectsProvider';

const page = {
  records: [
    {
      id: 'project-1',
      name: 'Project One',
      latestSessionId: 'session-1',
      updatedAt: '2026-09-21T08:00:00Z',
    },
    {
      id: 'project-2',
      name: 'Project Two',
      latestSessionId: 'session-2',
      updatedAt: '2026-09-21T07:00:00Z',
    },
  ],
  total: 2,
  pages: 1,
  current: 1,
  pageSize: 20,
};

function Consumer() {
  const { projects, error, retryInitial, markProjectActive } = useProjectsContext();

  return (
    <div>
      <div data-testid="projects">
        {projects
          .map((project) => project.id + ':' + project.latestSessionId + ':' + project.updatedAt)
          .join('|')}
      </div>
      {error ? <div role="alert">{error}</div> : null}
      <button
        type="button"
        onClick={() => markProjectActive('project-2', 'session-2-new', '2026-09-21T09:00:00Z')}
      >
        Mark active
      </button>
      <button type="button" onClick={() => void retryInitial()}>
        Retry initial
      </button>
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ProjectsProvider', () => {
  it('moves an active Project to the top and updates its Session', async () => {
    vi.spyOn(ProjectService, 'queryProject').mockResolvedValue(page);
    const user = userEvent.setup();

    render(
      <ProjectsProvider>
        <Consumer />
      </ProjectsProvider>,
    );

    expect(await screen.findByText(/project-1:session-1/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Mark active' }));

    expect(screen.getByTestId('projects').textContent).toBe(
      'project-2:session-2-new:2026-09-21T09:00:00Z|' + 'project-1:session-1:2026-09-21T08:00:00Z',
    );
  });

  it('retries the initial Project load after a failure', async () => {
    vi.spyOn(ProjectService, 'queryProject')
      .mockRejectedValueOnce(new Error('Unable to load projects.'))
      .mockResolvedValueOnce(page);
    const user = userEvent.setup();

    render(
      <ProjectsProvider>
        <Consumer />
      </ProjectsProvider>,
    );

    expect((await screen.findByRole('alert')).textContent).toContain('Unable to load projects.');

    await user.click(screen.getByRole('button', { name: 'Retry initial' }));

    expect(await screen.findByText(/project-1:session-1/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(ProjectService.queryProject).toHaveBeenCalledTimes(2);
  });
});
