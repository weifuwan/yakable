import { useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthProvider';

function initials(name: string, username: string) {
  const value = name.trim() || username.trim();
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return value.slice(0, 2).toUpperCase();
}

function closeMenu(event: MouseEvent<HTMLElement>) {
  event.currentTarget.closest('details')?.removeAttribute('open');
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  if (!user) return null;

  async function signOut() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError(null);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to log out.');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-2 outline-none hover:bg-navigation-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring-soft [&::-webkit-details-marker]:hidden">
        {user.avatar ? (
          <img src={user.avatar} alt="" className="size-8 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials(user.name, user.username)}
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-foreground-subtle">{user.username}</span>
        </span>
      </summary>

      <div className="absolute bottom-full left-0 right-0 z-30 mb-2 rounded-xl border border-border bg-surface p-1">
        {user.role === 'ADMIN' ? (
          <>
            <Link
              to="/settings/users"
              className="block rounded-lg px-3 py-2 text-sm text-foreground no-underline hover:bg-menu-hover"
              onClick={closeMenu}
            >
              Users
            </Link>
            <div className="my-1 border-t border-border-quiet" />
          </>
        ) : null}
        <Link
          to="/settings/profile"
          className="block rounded-lg px-3 py-2 text-sm text-foreground no-underline hover:bg-menu-hover"
          onClick={closeMenu}
        >
          Profile
        </Link>
        <Link
          to="/settings/profile#password"
          className="block rounded-lg px-3 py-2 text-sm text-foreground no-underline hover:bg-menu-hover"
          onClick={closeMenu}
        >
          Change password
        </Link>
        <div className="my-1 border-t border-border-quiet" />
        <button
          type="button"
          className="w-full rounded-lg border-0 bg-transparent px-3 py-2 text-left text-sm text-danger-foreground hover:bg-danger-surface disabled:opacity-50"
          onClick={() => void signOut()}
          disabled={loggingOut}
        >
          {loggingOut ? 'Logging out…' : 'Log out'}
        </button>
        {error ? (
          <p role="alert" className="m-0 px-3 py-2 text-xs text-danger-foreground">
            {error}
          </p>
        ) : null}
      </div>
    </details>
  );
}
