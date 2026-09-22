import { useState, type FormEvent } from 'react';

import {
  UserService,
  type UserRecord,
  type UserRole,
} from '@/service/user';
import { Button, Input } from '@/shared/ui';

interface UserFormDialogProps {
  user: UserRecord | null;
  currentUserId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function UserFormDialog({
  user,
  currentUserId,
  onClose,
  onSaved,
}: UserFormDialogProps) {
  const editing = user !== null;
  const self = user?.id === currentUserId;
  const [username, setUsername] = useState(user?.username ?? '');
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'USER');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    if (!editing && (password.length < 8 || password.length > 64)) {
      setError('Password must be 8–64 characters.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (user) {
        await UserService.updateUser(user.id, {
          name,
          email: email || null,
          avatar: avatar || null,
          role,
        });
      } else {
        await UserService.addUser({
          username,
          name,
          email: email || null,
          avatar: avatar || null,
          role,
          password,
        });
      }
      onSaved();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to save user.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex h-full w-full max-w-none items-center justify-center border-0 bg-black/20 p-4"
      aria-labelledby="user-dialog-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6">
        <div className="mb-6">
          <h2
            id="user-dialog-title"
            className="m-0 text-lg font-semibold tracking-[-0.02em]"
          >
            {editing ? 'Edit user' : 'Add user'}
          </h2>
          <p className="mb-0 mt-1 text-sm text-foreground-subtle">
            {editing
              ? 'Update account information and role.'
              : 'Create a user who can sign in to Yakable.'}
          </p>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <label htmlFor="user-username" className="text-sm font-medium">
              Username
            </label>
            <Input
              id="user-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              maxLength={64}
              disabled={editing || saving}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="user-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="user-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={64}
              disabled={saving}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="user-email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="user-avatar" className="text-sm font-medium">
              Avatar
            </label>
            <Input
              id="user-avatar"
              value={avatar}
              onChange={(event) => setAvatar(event.target.value)}
              maxLength={512}
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="user-role" className="text-sm font-medium">
              Role
            </label>
            <select
              id="user-role"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              disabled={saving || self}
              className="h-9 w-full rounded-lg border border-border-control bg-surface px-3 text-sm text-foreground outline-none focus:border-border-focus focus:outline-2 focus:outline-offset-1 focus:outline-focus-ring-soft disabled:opacity-50"
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
            {self ? (
              <p className="m-0 text-xs text-foreground-subtle">
                Your own admin role cannot be changed here.
              </p>
            ) : null}
          </div>

          {!editing ? (
            <div className="space-y-1.5">
              <label htmlFor="user-password" className="text-sm font-medium">
                Initial password
              </label>
              <Input
                id="user-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                maxLength={64}
                disabled={saving}
                required
              />
              <p className="m-0 text-xs text-foreground-subtle">
                Use 8–64 characters.
              </p>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="m-0 text-sm text-danger-foreground">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving || !username || !name || (!editing && !password)}
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add user'}
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
