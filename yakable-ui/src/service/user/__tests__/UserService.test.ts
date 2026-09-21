import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpUtils } from '@/service/http';

import { UserService } from '../UserService';

const currentUser = {
  id: 'user-1',
  username: 'alice',
  name: 'Alice',
  email: 'alice@example.com',
  avatar: null,
  role: 'USER' as const,
  status: 'ACTIVE' as const,
};

const managedUser = {
  ...currentUser,
  lastLoginAt: null,
  createdAt: '2026-09-21T09:00:00',
  updatedAt: '2026-09-21T09:00:00',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('UserService', () => {
  it('queries users with pagination and filters', async () => {
    const get = vi.spyOn(HttpUtils, 'get').mockResolvedValue({
      records: [managedUser],
      total: 1,
      pages: 1,
      current: 1,
      pageSize: 20,
    });

    await expect(
      UserService.queryUser({
        current: 1,
        pageSize: 20,
        keyword: 'ali',
        role: 'USER',
        status: 'ACTIVE',
      }),
    ).resolves.toMatchObject({
      total: 1,
      records: [managedUser],
    });

    expect(get).toHaveBeenCalledWith(
      '/api/users?current=1&pageSize=20&keyword=ali&role=USER&status=ACTIVE',
      { signal: undefined },
    );
  });

  it('creates a user through the admin contract', async () => {
    const post = vi.spyOn(HttpUtils, 'post').mockResolvedValue(managedUser);

    await expect(
      UserService.addUser({
        username: 'alice',
        name: 'Alice',
        role: 'USER',
        password: 'password123',
      }),
    ).resolves.toEqual(managedUser);

    expect(post).toHaveBeenCalledWith(
      '/api/users',
      {
        username: 'alice',
        name: 'Alice',
        role: 'USER',
        password: 'password123',
      },
      { signal: undefined },
    );
  });

  it('updates a user status through the encoded user path', async () => {
    const put = vi.spyOn(HttpUtils, 'put').mockResolvedValue(null);

    await UserService.updateUserStatus('user/1', {
      status: 'DISABLED',
    });

    expect(put).toHaveBeenCalledWith(
      '/api/users/user%2F1/status',
      { status: 'DISABLED' },
      { signal: undefined },
    );
  });

  it('resets another user password', async () => {
    const put = vi.spyOn(HttpUtils, 'put').mockResolvedValue(null);

    await UserService.resetUserPassword('user-1', {
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    });

    expect(put).toHaveBeenCalledWith(
      '/api/users/user-1/password',
      {
        newPassword: 'new-password',
        confirmPassword: 'new-password',
      },
      { signal: undefined },
    );
  });

  it('updates the current user profile', async () => {
    const put = vi.spyOn(HttpUtils, 'put').mockResolvedValue(currentUser);

    await expect(
      UserService.updateCurrentUser({
        name: 'Alice',
        email: 'alice@example.com',
        avatar: null,
      }),
    ).resolves.toEqual(currentUser);

    expect(put).toHaveBeenCalledWith(
      '/api/users/me',
      {
        name: 'Alice',
        email: 'alice@example.com',
        avatar: null,
      },
      { signal: undefined },
    );
  });

  it('changes the current user password', async () => {
    const put = vi.spyOn(HttpUtils, 'put').mockResolvedValue(null);

    await UserService.updateCurrentUserPassword({
      currentPassword: 'password123',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    });

    expect(put).toHaveBeenCalledWith(
      '/api/users/me/password',
      {
        currentPassword: 'password123',
        newPassword: 'new-password',
        confirmPassword: 'new-password',
      },
      { signal: undefined },
    );
  });

  it('rejects an invalid user-list response', async () => {
    vi.spyOn(HttpUtils, 'get').mockResolvedValue({
      records: [{ id: 'user-1' }],
      total: 1,
      pages: 1,
      current: 1,
      pageSize: 20,
    });

    await expect(
      UserService.queryUser({ current: 1, pageSize: 20 }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'parse',
    });
  });
});
