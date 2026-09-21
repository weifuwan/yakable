import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/features/auth';

function AuthLoading() {
  return (
    <div
      className="flex h-full items-center justify-center bg-background text-sm text-foreground-subtle"
      role="status"
    >
      Loading…
    </div>
  );
}

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <AuthLoading />;
  }
  if (status === 'anonymous') {
    const from = location.pathname + location.search + location.hash;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const { user } = useAuth();

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

export function AnonymousOnly() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <AuthLoading />;
  }
  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
