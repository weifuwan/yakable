import { ApiError, HttpUtils } from '../http';
import { isCurrentUser } from '../user';
import type { CurrentUser } from '../user';
import type { LoginInput } from './types';

function invalidUser(data: unknown): never {
  throw new ApiError('Auth API returned an invalid user.', {
    kind: 'parse',
    data,
  });
}

async function login(input: LoginInput, signal?: AbortSignal): Promise<CurrentUser> {
  const data = await HttpUtils.post<unknown>('/api/auth/login', input, {
    signal,
  });
  return isCurrentUser(data) ? data : invalidUser(data);
}

async function logout(signal?: AbortSignal) {
  await HttpUtils.post<null>('/api/auth/logout', {}, { signal });
}

async function queryCurrentUser(signal?: AbortSignal): Promise<CurrentUser> {
  const data = await HttpUtils.get<unknown>('/api/auth/me', { signal });
  return isCurrentUser(data) ? data : invalidUser(data);
}

export const AuthService = {
  login,
  logout,
  queryCurrentUser,
};
