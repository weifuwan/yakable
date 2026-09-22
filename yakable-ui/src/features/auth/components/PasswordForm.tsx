import { useState, type FormEvent } from 'react';

import { UserService } from '@/service/user';
import { Button, Input } from '@/shared/ui';

import { useAuth } from '../context/AuthProvider';

export interface PasswordFormProps {
  onChanged: () => void;
}

export function PasswordForm({ onChanged }: PasswordFormProps) {
  const { invalidate } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    if (newPassword.length < 8 || newPassword.length > 64) {
      setError('New password must be 8–64 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await UserService.updateCurrentUserPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      invalidate();
      onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to change password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-1.5">
        <label htmlFor="current-password" className="text-sm font-medium">
          Current password
        </label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          disabled={saving}
          required
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="new-password" className="text-sm font-medium">
          New password
        </label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          minLength={8}
          maxLength={64}
          disabled={saving}
          required
        />
        <p className="m-0 text-xs text-foreground-subtle">Use 8–64 characters.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirm-password" className="text-sm font-medium">
          Confirm new password
        </label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
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

      <Button
        type="submit"
        variant="primary"
        disabled={saving || !currentPassword || !newPassword || !confirmPassword}
      >
        {saving ? 'Changing…' : 'Change password'}
      </Button>
    </form>
  );
}
