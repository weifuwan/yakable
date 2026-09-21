export type UserRole = 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface CurrentUser {
  id: string;
  username: string;
  name: string;
  email: string | null;
  avatar: string | null;
  role: UserRole;
  status: UserStatus;
}

export interface UserRecord extends CurrentUser {
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageData<T> {
  records: T[];
  total: number;
  pages: number;
  current: number;
  pageSize: number;
}

export interface QueryUsersInput {
  current: number;
  pageSize: number;
  keyword?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface AddUserInput {
  username: string;
  name: string;
  email?: string | null;
  avatar?: string | null;
  role?: UserRole;
  password: string;
}

export interface UpdateUserInput {
  name: string;
  email?: string | null;
  avatar?: string | null;
  role: UserRole;
}

export interface UpdateUserStatusInput {
  status: UserStatus;
}

export interface ResetUserPasswordInput {
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateCurrentUserInput {
  name: string;
  email?: string | null;
  avatar?: string | null;
}

export interface UpdateCurrentUserPasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
