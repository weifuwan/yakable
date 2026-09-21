import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectsProvider } from '../context/ProjectsProvider';
import { CreateProjectComposer } from './CreateProjectComposer';

const createdProject = {
  id: 'project-123',
  name: 'Build a CRM dashboard',
  latestSessionId: 'session-123',
  status: 'CREATED',
  createdAt: '2026-09-19T00:00:00Z',
  updatedAt: '2026-09-19T00:00:00Z',
};

function apiResponse(data: unknown, status = 200) {
  return new Response(
    JSON.stringify({ code: 0, message: 'Success', data }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

function emptyProjectPage() {
  return {
    records: [],
    total: 0,
    pages: 0,
    current: 1,
    pageSize: 50,
  };
}

function stubProjectApi() {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return apiResponse(createdProject, 201);
      }

      return apiResponse(emptyProjectPage());
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
            path="/dashboard/project/:projectId/session/:sessionId"
            element={<div>Project session destination</div>}
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
  it('shows a composer skeleton while the initial project list is loading', async () => {
    let resolveProjects!: (response: Response) => void;
    const pendingProjects = new Promise<Response>((resolve) => {
      resolveProjects = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(apiResponse(createdProject, 201));
        }
        return pendingProjects;
      }),
    );

    renderComposer();

    expect(
      screen.getByRole('status', { name: 'Loading prompt composer' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('textbox', {
        name: 'Describe the project you want to build',
      }),
    ).toBeNull();

    resolveProjects(apiResponse(emptyProjectPage()));

    expect(
      await screen.findByRole('textbox', {
        name: 'Describe the project you want to build',
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('status', { name: 'Loading prompt composer' }),
    ).toBeNull();
  });

  it('enables the create button when the prompt contains text', async () => {
    stubProjectApi();
    renderComposer();

    const input = await screen.findByRole('textbox', {
      name: 'Describe the project you want to build',
    });
    const submitButton = screen.getByRole('button', { name: 'Create project' });

    expect((submitButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'Build a CRM dashboard' } });
    expect((submitButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('creates with the selected model and navigates to the session route', async () => {
    const fetchMock = stubProjectApi();
    renderComposer();

    await screen.findByRole('textbox', {
      name: 'Describe the project you want to build',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select model' }));
    fireEvent.click(screen.getByRole('option', { name: 'Kimi' }));

    fireEvent.change(
      screen.getByRole('textbox', {
        name: 'Describe the project you want to build',
      }),
      { target: { value: 'Build a CRM dashboard' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect(
      await screen.findByText('Project session destination'),
    ).toBeTruthy();

    const postCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'POST',
    );
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
