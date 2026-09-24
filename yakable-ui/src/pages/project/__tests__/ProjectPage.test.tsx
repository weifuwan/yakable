import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ProjectPage } from '../index';

const projectState = vi.hoisted(() => ({
  markProjectActive: vi.fn(),
}));

vi.mock('@/features/project', () => ({
  ProjectFilesBrowser: ({ projectId, refreshKey }: { projectId: string; refreshKey?: number }) => (
    <div>
      files:{projectId}:{refreshKey ?? 0}
    </div>
  ),
  useProjects: () => ({
    markProjectActive: projectState.markProjectActive,
  }),
}));

vi.mock('@/features/session', () => ({
  SessionWorkspace: ({
    projectId,
    sessionId,
    onActivity,
    onTurnSucceeded,
  }: {
    projectId: string;
    sessionId: string;
    onActivity?: (sessionId: string, updatedAt: string) => void;
    onTurnSucceeded?: () => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onActivity?.('session-2', '2026-09-21T09:00:00Z');
        onTurnSucceeded?.();
      }}
    >
      {projectId}:{sessionId}
    </button>
  ),
}));

describe('ProjectPage', () => {
  it('moves the current Project when its Session becomes active', async () => {
    const user = userEvent.setup();
    projectState.markProjectActive.mockReset();

    render(
      <MemoryRouter initialEntries={['/dashboard/project/project-1/session/session-1']}>
        <Routes>
          <Route
            path="/dashboard/project/:projectId/session/:sessionId"
            element={<ProjectPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('files:project-1:0')).toBeTruthy();

    await user.click(
      screen.getByRole('button', {
        name: 'project-1:session-1',
      }),
    );

    expect(projectState.markProjectActive).toHaveBeenCalledWith(
      'project-1',
      'session-2',
      '2026-09-21T09:00:00Z',
    );
    expect(screen.getByText('files:project-1:1')).toBeTruthy();
  });
});
