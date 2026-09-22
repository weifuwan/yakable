import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpUtils } from '@/service/http';

import { AuthService } from '../AuthService';

const user = {
  id: 'user-1',
  username: 'alice',
  name: 'Alice',
  email: null,
  avatar: null,
  role: 'USER' as const,
  status: 'ACTIVE' as const,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AuthService', () => {
  it('logs in with the backend auth contract', async () => {
    const post = vi.spyOn(HttpUtils, 'post').mockResolvedValue(user);

    await expect(
      AuthService.login({
        username: 'alice',
        password: 'password123',
      }),
    ).resolves.toEqual(user);

    expect(post).toHaveBeenCalledWith(
      '/api/auth/login',
      {
        username: 'alice',
        password: 'password123',
      },
      { signal: undefined },
    );
  });

  it('loads the current user', async () => {
    const get = vi.spyOn(HttpUtils, 'get').mockResolvedValue(user);

    await expect(AuthService.queryCurrentUser()).resolves.toEqual(user);

    expect(get).toHaveBeenCalledWith('/api/auth/me', {
      signal: undefined,
    });
  });

  it('rejects an invalid current-user response', async () => {
    vi.spyOn(HttpUtils, 'get').mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    });

    await expect(AuthService.queryCurrentUser()).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'parse',
    });
  });

  it('logs out through the backend session endpoint', async () => {
    const post = vi.spyOn(HttpUtils, 'post').mockResolvedValue(null);

    await AuthService.logout();

    expect(post).toHaveBeenCalledWith(
      '/api/auth/logout',
      {},
      {
        signal: undefined,
      },
    );
  });
});
