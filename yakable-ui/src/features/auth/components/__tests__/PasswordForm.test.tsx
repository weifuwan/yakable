import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserService } from '@/service/user';

import { PasswordForm } from '../PasswordForm';

const invalidate = vi.fn();

vi.mock('@/features/auth/context/AuthProvider', () => ({
  useAuth: () => ({ invalidate }),
}));

vi.mock('@/service/user', async () => {
  const actual = await vi.importActual<typeof import('@/service/user')>('@/service/user');
  return {
    ...actual,
    UserService: {
      ...actual.UserService,
      updateCurrentUserPassword: vi.fn(),
    },
  };
});

beforeEach(() => {
  invalidate.mockReset();
  vi.mocked(UserService.updateCurrentUserPassword).mockReset();
});

describe('PasswordForm', () => {
  it('rejects mismatched confirmation before calling the API', async () => {
    const user = userEvent.setup();

    render(<PasswordForm onChanged={vi.fn()} />);

    await user.type(screen.getByLabelText('Current password'), 'password123');
    await user.type(screen.getByLabelText('New password'), 'new-password');
    await user.type(screen.getByLabelText('Confirm new password'), 'different-password');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(screen.getByRole('alert').textContent).toContain('Password confirmation does not match');
    expect(UserService.updateCurrentUserPassword).not.toHaveBeenCalled();
  });

  it('changes the password, invalidates auth and completes the flow', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    vi.mocked(UserService.updateCurrentUserPassword).mockResolvedValue();

    render(<PasswordForm onChanged={onChanged} />);

    await user.type(screen.getByLabelText('Current password'), 'password123');
    await user.type(screen.getByLabelText('New password'), 'new-password');
    await user.type(screen.getByLabelText('Confirm new password'), 'new-password');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(UserService.updateCurrentUserPassword).toHaveBeenCalledWith({
      currentPassword: 'password123',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    });
    expect(invalidate).toHaveBeenCalledOnce();
    expect(onChanged).toHaveBeenCalledOnce();
  });
});
