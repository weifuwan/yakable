import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MemoryRouter,
  Route,
  Routes,
} from 'react-router-dom';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ProjectService } from '@/service/project';

import { CreateProjectComposer } from '../CreateProjectComposer';

const projectState = vi.hoisted(() => ({
  isLoading: false,
  upsertProject: vi.fn(),
}));

vi.mock('../../hooks/useProjects', () => ({
  useProjects: () => projectState,
}));

const createdProject = {
  id: 'project-123',
  name: 'Build a CRM dashboard',
  latestSessionId: 'session-123',
  updatedAt: '2026-09-21T00:00:00Z',
};

function renderComposer() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route
          path="/dashboard"
          element={<CreateProjectComposer />}
        />
        <Route
          path="/dashboard/project/:projectId/session/:sessionId"
          element={<div>Project session destination</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  projectState.isLoading = false;
  projectState.upsertProject.mockReset();
  vi.restoreAllMocks();
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
    '00000000-0000-4000-8000-000000000001',
  );
});

describe('CreateProjectComposer', () => {
  it('shows the loading state before the composer is ready', () => {
    projectState.isLoading = true;

    renderComposer();

    expect(
      screen.getByRole('status', {
        name: 'Loading prompt composer',
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('textbox', {
        name: 'Describe the project you want to build',
      }),
    ).toBeNull();
  });

  it('creates with the selected model and navigates to the session', async () => {
    const user = userEvent.setup();
    const addProject = vi
      .spyOn(ProjectService, 'addProject')
      .mockResolvedValue(createdProject);

    renderComposer();

    const modelTrigger = screen.getByRole('button', {
      name: 'Select model',
    });
    expect(modelTrigger.getAttribute('data-surface')).toBe('borderless');

    await user.click(modelTrigger);
    await user.click(screen.getByRole('menuitemradio', { name: 'Kimi' }));

    const input = screen.getByRole('textbox', {
      name: 'Describe the project you want to build',
    });
    await user.type(input, 'Build a CRM dashboard');
    await user.click(
      screen.getByRole('button', { name: 'Create project' }),
    );

    expect(
      await screen.findByText('Project session destination'),
    ).toBeTruthy();
    expect(addProject).toHaveBeenCalledWith({
      prompt: 'Build a CRM dashboard',
      model: {
        provider: 'kimi',
        model: 'kimi-k3',
      },
      requestId: '00000000-0000-4000-8000-000000000001',
    });
    expect(projectState.upsertProject).toHaveBeenCalledWith(createdProject);
  });

  it('shows the creation error and keeps the same request identity for retry', async () => {
    const user = userEvent.setup();

    const addProject = vi.spyOn(ProjectService, 'addProject')
      .mockRejectedValueOnce(new Error('Unable to create project.'))
      .mockResolvedValueOnce(createdProject);

    renderComposer();

    const input = screen.getByRole('textbox', {
      name: 'Describe the project you want to build',
    });
    await user.type(input, 'Build a CRM dashboard');
    await user.click(
      screen.getByRole('button', { name: 'Create project' }),
    );

    expect(
      (await screen.findByRole('alert')).textContent,
    ).toContain('Unable to create project.');
    await waitFor(() => {
      expect((input as HTMLTextAreaElement).value).toBe(
        'Build a CRM dashboard',
      );
    });

    await user.click(
      screen.getByRole('button', { name: 'Create project' }),
    );

    await waitFor(() => {
      expect(addProject).toHaveBeenCalledTimes(2);
    });
    expect(addProject.mock.calls[0][0].requestId).toBe(
      addProject.mock.calls[1][0].requestId,
    );
  });
});
