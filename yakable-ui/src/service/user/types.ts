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
