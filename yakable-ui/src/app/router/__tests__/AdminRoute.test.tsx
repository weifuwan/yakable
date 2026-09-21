import { render, screen } from '@testing-library/react';
import {
  MemoryRouter,
  Route,
  Routes,
} from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@/features/auth';

import { RequireAdmin } from '../AuthRoutes';

vi.mock('@/features/auth', () => ({
  useAuth: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(useAuth).mockReset();
});

describe('RequireAdmin', () => {
  it('redirects a normal user away from the users page', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-1',
        username: 'alice',
        name: 'Alice',
        email: null,
        avatar: null,
        role: 'USER',
        status: 'ACTIVE',
      },
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      syncUser: vi.fn(),
      invalidate: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/settings/users']}>
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard</div>} />
          <Route element={<RequireAdmin />}>
            <Route path="/settings/users" element={<div>Users admin</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Dashboard')).toBeTruthy();
    expect(screen.queryByText('Users admin')).toBeNull();
  });

  it('renders the users route for an admin', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'admin-1',
        username: 'admin',
        name: 'Administrator',
        email: null,
        avatar: null,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      syncUser: vi.fn(),
      invalidate: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/settings/users']}>
        <Routes>
          <Route element={<RequireAdmin />}>
            <Route path="/settings/users" element={<div>Users admin</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Users admin')).toBeTruthy();
  });
});
