import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UsersTable } from '../UsersTable';

describe('UsersTable', () => {
  it('disables destructive self-management actions for the current admin', () => {
    render(
      <UsersTable
        users={[
          {
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
          },
        ]}
        currentUserId="admin-1"
        busyUserId={null}
        onEdit={vi.fn()}
        onToggleStatus={vi.fn()}
        onResetPassword={vi.fn()}
      />,
    );

    expect(
      (screen.getByRole('button', { name: 'Reset password' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Disable' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Edit' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});
