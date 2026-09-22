import { useState, type FormEvent } from 'react';

import { UserService, type UserRecord } from '@/service/user';
import { Button, Input } from '@/shared/ui';

interface ResetPasswordDialogProps {
  user: UserRecord;
  onClose: () => void;
  onReset: () => void;
}

export function ResetPasswordDialog({
  user,
  onClose,
  onReset,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    if (password.length < 8 || password.length > 64) {
      setError('Password must be 8–64 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Password confirmation does not match.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await UserService.resetUserPassword(user.id, {
        newPassword: password,
        confirmPassword: confirmation,
      });
      onReset();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to reset password.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex h-full w-full max-w-none items-center justify-center border-0 bg-black/20 p-4"
      aria-labelledby="reset-password-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
        <h2
          id="reset-password-title"
          className="m-0 text-lg font-semibold tracking-[-0.02em]"
        >
          Reset password
        </h2>
        <p className="mb-6 mt-1 text-sm text-foreground-subtle">
          Reset the password for {user.name || user.username}. Existing
          sessions will be signed out.
        </p>

        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <label htmlFor="reset-password" className="text-sm font-medium">
              New password
            </label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              maxLength={64}
              disabled={saving}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="reset-password-confirmation"
              className="text-sm font-medium"
            >
              Confirm password
            </label>
            <Input
              id="reset-password-confirmation"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              minLength={8}
              maxLength={64}
              disabled={saving}
              required
            />
          </div>

          {error ? (
            <p role="alert" className="m-0 text-sm text-danger-foreground">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving || !password || !confirmation}
            >
              {saving ? 'Resetting…' : 'Reset password'}
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
