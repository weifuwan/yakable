import { useLocation, useNavigate } from 'react-router-dom';

import { LoginForm } from '@/features/auth';

const logoUrl = new URL('../../assets/logo.png', import.meta.url).href;

interface LoginLocationState {
  from?: unknown;
  message?: unknown;
}

function safeDestination(value: unknown) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//')
  ) {
    return '/dashboard';
  }
  return value;
}

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? {}) as LoginLocationState;
  const message = typeof state.message === 'string' ? state.message : null;

  return (
    <main className="flex h-full min-h-0 items-center justify-center bg-background px-6 py-10 text-foreground">
      <section className="w-full max-w-sm rounded-2xl border border-border bg-surface p-7">
        <div className="mb-7 flex items-center gap-2">
          <img
            src={logoUrl}
            alt=""
            aria-hidden="true"
            className="size-8 rounded-lg object-contain"
          />
          <span className="text-base font-semibold tracking-[-0.02em]">
            Yakable
          </span>
        </div>

        <h1 className="m-0 text-2xl font-semibold tracking-[-0.03em]">
          Sign in
        </h1>
        <p className="mb-6 mt-2 text-sm leading-6 text-foreground-subtle">
          Continue to Yakable.
        </p>

        {message ? (
          <output className="mb-4 block rounded-lg border border-border-quiet bg-surface-hover-subtle px-3 py-2 text-sm text-foreground-secondary">
            {message}
          </output>
        ) : null}

        <LoginForm
          onSuccess={() =>
            navigate(safeDestination(state.from), { replace: true })
          }
        />
      </section>
    </main>
  );
}
