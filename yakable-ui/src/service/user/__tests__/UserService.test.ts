import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpUtils } from '@/service/http';

import { UserService } from '../UserService';

const user = {
  id: 'user-1',
  username: 'alice',
  name: 'Alice',
  email: 'alice@example.com',
  avatar: null,
  role: 'USER' as const,
  status: 'ACTIVE' as const,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('UserService', () => {
  it('updates the current user profile', async () => {
    const put = vi.spyOn(HttpUtils, 'put').mockResolvedValue(user);

    await expect(
      UserService.updateCurrentUser({
        name: 'Alice',
        email: 'alice@example.com',
        avatar: null,
      }),
    ).resolves.toEqual(user);

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

  it('rejects an invalid profile response', async () => {
    vi.spyOn(HttpUtils, 'put').mockResolvedValue({
      id: 'user-1',
      name: 'Alice',
    });

    await expect(
      UserService.updateCurrentUser({
        name: 'Alice',
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'parse',
    });
  });
});
