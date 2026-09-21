import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { PasswordForm, ProfileForm, useAuth } from '@/features/auth';

export function ProfilePage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.hash === '#password') {
      document.getElementById('password')?.scrollIntoView({
        block: 'start',
      });
    }
  }, [location.hash]);

  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="m-0 text-2xl font-semibold tracking-[-0.03em]">
          Profile
        </h1>
        <p className="mb-0 mt-2 text-sm text-foreground-subtle">
          Manage your account information and password.
        </p>
      </header>

      <section className="rounded-2xl border border-border p-6">
        <div className="mb-5">
          <h2 className="m-0 text-base font-semibold">Account information</h2>
          <p className="mb-0 mt-1 text-sm text-foreground-subtle">
            Username{' '}
            <strong className="font-medium text-foreground">
              {user.username}
            </strong>{' '}
            cannot be changed.
          </p>
        </div>
        <ProfileForm />
      </section>

      <section
        id="password"
        className="mt-6 scroll-mt-6 rounded-2xl border border-border p-6"
      >
        <div className="mb-5">
          <h2 className="m-0 text-base font-semibold">Password</h2>
          <p className="mb-0 mt-1 text-sm text-foreground-subtle">
            Changing your password signs you out of all sessions.
          </p>
        </div>
        <PasswordForm
          onChanged={() =>
            navigate('/login', {
              replace: true,
              state: { message: 'Password changed. Sign in again.' },
            })
          }
        />
      </section>
    </div>
  );
}
