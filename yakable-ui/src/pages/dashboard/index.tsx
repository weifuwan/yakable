import { AppShell } from '@/app/layout/Layout';

export function DashboardPage() {
  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center px-6 py-16">
        <div className="max-w-lg text-center">
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.025em]">
            Yakable
          </h1>
          <p className="mb-0 mt-3 text-sm leading-6 text-black/45">
            Frontend architecture baseline is ready. Product features will be rebuilt one at a time.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

export { DashboardPage as Dashboard };
