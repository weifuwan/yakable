import { ApiError, HttpUtils } from '../http';
import type {
  AddUserInput,
  CurrentUser,
  PageData,
  QueryUsersInput,
  ResetUserPasswordInput,
  UpdateCurrentUserInput,
  UpdateCurrentUserPasswordInput,
  UpdateUserInput,
  UpdateUserStatusInput,
  UserRecord,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

export function isCurrentUser(value: unknown): value is CurrentUser {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.username === 'string' &&
    typeof value.name === 'string' &&
    isNullableString(value.email) &&
    isNullableString(value.avatar) &&
    (value.role === 'ADMIN' || value.role === 'USER') &&
    (value.status === 'ACTIVE' || value.status === 'DISABLED')
  );
}

function isUserRecord(value: unknown): value is UserRecord {
  return (
    isCurrentUser(value) &&
    isRecord(value) &&
    isNullableString(value.lastLoginAt) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isUserPage(value: unknown): value is PageData<UserRecord> {
  return (
    isRecord(value) &&
    Array.isArray(value.records) &&
    value.records.every(isUserRecord) &&
    typeof value.total === 'number' &&
    typeof value.pages === 'number' &&
    typeof value.current === 'number' &&
    typeof value.pageSize === 'number'
  );
}

function invalidUser(data: unknown): never {
  throw new ApiError('User API returned an invalid user.', {
    kind: 'parse',
    data,
  });
}

function invalidUserPage(data: unknown): never {
  throw new ApiError('User API returned invalid PageData.', {
    kind: 'parse',
    data,
  });
}

async function queryUser(input: QueryUsersInput, signal?: AbortSignal) {
  const params = new URLSearchParams({
    current: String(input.current),
    pageSize: String(input.pageSize),
  });
  if (input.keyword) params.set('keyword', input.keyword);
  if (input.role) params.set('role', input.role);
  if (input.status) params.set('status', input.status);

  const data = await HttpUtils.get<unknown>('/api/users?' + params.toString(), {
    signal,
  });
  return isUserPage(data) ? data : invalidUserPage(data);
}

async function addUser(input: AddUserInput, signal?: AbortSignal) {
  const data = await HttpUtils.post<unknown>('/api/users', input, { signal });
  return isUserRecord(data) ? data : invalidUser(data);
}

async function updateUser(
  userId: string,
  input: UpdateUserInput,
  signal?: AbortSignal,
) {
  const data = await HttpUtils.put<unknown>(
    '/api/users/' + encodeURIComponent(userId),
    input,
    { signal },
  );
  return isUserRecord(data) ? data : invalidUser(data);
}

async function updateUserStatus(
  userId: string,
  input: UpdateUserStatusInput,
  signal?: AbortSignal,
) {
  await HttpUtils.put<null>(
    '/api/users/' + encodeURIComponent(userId) + '/status',
    input,
    { signal },
  );
}

async function resetUserPassword(
  userId: string,
  input: ResetUserPasswordInput,
  signal?: AbortSignal,
) {
  await HttpUtils.put<null>(
    '/api/users/' + encodeURIComponent(userId) + '/password',
    input,
    { signal },
  );
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
  queryUser,
  addUser,
  updateUser,
  updateUserStatus,
  resetUserPassword,
  updateCurrentUser,
  updateCurrentUserPassword,
};
