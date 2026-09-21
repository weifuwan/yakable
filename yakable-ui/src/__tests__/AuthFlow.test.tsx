import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MemoryRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnonymousOnly, RequireAuth } from '@/app/router/AuthRoutes';
import { AuthProvider } from '@/features/auth';
import { LoginPage } from '@/pages/login';
import { AuthService } from '@/service/auth';

vi.mock('@/service/auth', () => ({
  AuthService: {
    queryCurrentUser: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

const currentUser = {
  id: 'user-1',
  username: 'alice',
  name: 'Alice',
  email: null,
  avatar: null,
  role: 'USER' as const,
  status: 'ACTIVE' as const,
};

function TestRoutes() {
  return (
    <AuthProvider>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<AnonymousOnly />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route
              path="/dashboard"
              element={<div>Authenticated dashboard</div>}
            />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

beforeEach(() => {
  vi.mocked(AuthService.queryCurrentUser).mockReset();
  vi.mocked(AuthService.login).mockReset();
  vi.mocked(AuthService.logout).mockReset();
});

describe('authentication flow', () => {
  it('redirects an anonymous user to login and returns after sign in', async () => {
    const user = userEvent.setup();
    vi.mocked(AuthService.queryCurrentUser).mockRejectedValue(
      new Error('Authentication required'),
    );
    vi.mocked(AuthService.login).mockResolvedValue(currentUser);

    render(<TestRoutes />);

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeTruthy();

    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(AuthService.login).toHaveBeenCalledWith({
      username: 'alice',
      password: 'password123',
    });
    expect(
      await screen.findByText('Authenticated dashboard'),
    ).toBeTruthy();
  });

  it('renders protected content when the session is already valid', async () => {
    vi.mocked(AuthService.queryCurrentUser).mockResolvedValue(currentUser);

    render(<TestRoutes />);

    expect(
      await screen.findByText('Authenticated dashboard'),
    ).toBeTruthy();
    expect(
      screen.queryByRole('heading', { name: 'Sign in' }),
    ).toBeNull();
  });
});
