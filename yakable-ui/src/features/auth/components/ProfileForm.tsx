import { useState, type FormEvent } from 'react';

import { UserService } from '@/service/user';
import { Button, Input } from '@/shared/ui';

import { useAuth } from '../context/AuthProvider';

export function ProfileForm() {
  const { user, syncUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await UserService.updateCurrentUser({
        name,
        email: email || null,
        avatar: avatar || null,
      });
      syncUser(updated);
      setName(updated.name);
      setEmail(updated.email ?? '');
      setAvatar(updated.avatar ?? '');
      setMessage('Profile updated.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-1.5">
        <label htmlFor="profile-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="profile-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={64}
          required
          disabled={saving}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="profile-email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="profile-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
          disabled={saving}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="profile-avatar" className="text-sm font-medium">
          Avatar URL
        </label>
        <Input
          id="profile-avatar"
          value={avatar}
          onChange={(event) => setAvatar(event.target.value)}
          maxLength={512}
          placeholder="Avatar location"
          disabled={saving}
        />
      </div>

      {error ? (
        <p role="alert" className="m-0 text-sm text-danger-foreground">
          {error}
        </p>
      ) : null}
      {message ? <output className="block text-sm text-success">{message}</output> : null}

      <Button type="submit" variant="primary" disabled={saving || !name}>
        {saving ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  );
}
