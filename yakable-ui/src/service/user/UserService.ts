import { ApiError, HttpUtils } from '../http';
import type {
  CurrentUser,
  UpdateCurrentUserInput,
  UpdateCurrentUserPasswordInput,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isCurrentUser(value: unknown): value is CurrentUser {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.username === 'string' &&
    typeof value.name === 'string' &&
    (typeof value.email === 'string' || value.email === null) &&
    (typeof value.avatar === 'string' || value.avatar === null) &&
    (value.role === 'ADMIN' || value.role === 'USER') &&
    (value.status === 'ACTIVE' || value.status === 'DISABLED')
  );
}

function invalidUser(data: unknown): never {
  throw new ApiError('User API returned an invalid user.', {
    kind: 'parse',
    data,
  });
}

async function updateCurrentUser(
  input: UpdateCurrentUserInput,
  signal?: AbortSignal,
) {
  const data = await HttpUtils.put<unknown>('/api/users/me', input, {
    signal,
  });
  return isCurrentUser(data) ? data : invalidUser(data);
}

async function updateCurrentUserPassword(
  input: UpdateCurrentUserPasswordInput,
  signal?: AbortSignal,
) {
  await HttpUtils.put<null>('/api/users/me/password', input, { signal });
}

export const UserService = {
  updateCurrentUser,
  updateCurrentUserPassword,
};
