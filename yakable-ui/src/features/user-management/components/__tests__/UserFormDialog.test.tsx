import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserService } from '@/service/user';

import { UserFormDialog } from '../UserFormDialog';

vi.mock('@/service/user', async () => {
  const actual = await vi.importActual<typeof import('@/service/user')>('@/service/user');
  return {
    ...actual,
    UserService: {
      ...actual.UserService,
      addUser: vi.fn(),
      updateUser: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.mocked(UserService.addUser).mockReset();
  vi.mocked(UserService.updateUser).mockReset();
});

describe('UserFormDialog', () => {
  it('creates a USER by default', async () => {
    const actor = userEvent.setup();
    const onSaved = vi.fn();
    vi.mocked(UserService.addUser).mockResolvedValue({
      id: 'user-1',
      username: 'alice',
      name: 'Alice',
      email: null,
      avatar: null,
      role: 'USER',
      status: 'ACTIVE',
      lastLoginAt: null,
      createdAt: '2026-09-21T09:00:00',
      updatedAt: '2026-09-21T09:00:00',
    });

    render(
      <UserFormDialog user={null} currentUserId="admin-1" onClose={vi.fn()} onSaved={onSaved} />,
    );

    await actor.type(screen.getByLabelText('Username'), 'alice');
    await actor.type(screen.getByLabelText('Name'), 'Alice');
    await actor.type(screen.getByLabelText('Initial password'), 'password123');
    await actor.click(screen.getByRole('button', { name: 'Add user' }));

    expect(UserService.addUser).toHaveBeenCalledWith({
      username: 'alice',
      name: 'Alice',
      email: null,
      avatar: null,
      role: 'USER',
      password: 'password123',
    });
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('does not allow the current admin to change their own role', () => {
    render(
      <UserFormDialog
        user={{
          id: 'admin-1',
          username: 'admin',
          name: 'Administrator',
          email: null,
          avatar: null,
          role: 'ADMIN',
          status: 'ACTIVE',
          lastLoginAt: null,
          createdAt: '2026-09-21T09:00:00',
          updatedAt: '2026-09-21T09:00:00',
        }}
        currentUserId="admin-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect((screen.getByLabelText('Role') as HTMLSelectElement).disabled).toBe(true);
  });
});
