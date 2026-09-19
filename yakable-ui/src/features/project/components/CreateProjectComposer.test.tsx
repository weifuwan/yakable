import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectsProvider } from '../context/ProjectsProvider';
import { CreateProjectComposer } from './CreateProjectComposer';

const createdProject = {
  id: 'project-123',
  name: 'Build a CRM dashboard',
  prompt: 'Build a CRM dashboard',
  model: {
    provider: 'kimi',
    model: 'kimi-k3',
  },
  status: 'CREATED',
  createdAt: '2026-09-19T00:00:00Z',
  updatedAt: '2026-09-19T00:00:00Z',
};

function stubProjectApi() {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return {
          ok: true,
          status: 201,
          json: async () => createdProject,
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => [],
      };
    },
  );

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderComposer() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <ProjectsProvider>
        <Routes>
          <Route path="/dashboard" element={<CreateProjectComposer />} />
          <Route
            path="/dashboard/project/:projectId"
            element={<div>Project destination</div>}
          />
        </Routes>
      </ProjectsProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CreateProjectComposer', () => {
  it('enables the create button when the prompt contains text', () => {
    stubProjectApi();
    renderComposer();

    const input = screen.getByRole('textbox', {
      name: 'Describe the project you want to build',
    });
    const submitButton = screen.getByRole('button', { name: 'Create project' });

    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'Build a CRM dashboard' } });

    expect((submitButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('creates with the selected model and navigates to the project route', async () => {
    const fetchMock = stubProjectApi();
    renderComposer();

    fireEvent.click(screen.getByRole('button', { name: 'Select model' }));
    fireEvent.click(screen.getByRole('option', { name: 'Kimi' }));

    fireEvent.change(
      screen.getByRole('textbox', {
        name: 'Describe the project you want to build',
      }),
      { target: { value: 'Build a CRM dashboard' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('Project destination')).toBeTruthy();

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeTruthy();
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      prompt: 'Build a CRM dashboard',
      model: {
        provider: 'kimi',
        model: 'kimi-k3',
      },
    });
  });
});
