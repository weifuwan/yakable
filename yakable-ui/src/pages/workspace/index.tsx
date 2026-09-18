import { AppShell } from '@/app/layout/Layout';

export function WorkspacePage() {
  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center px-6 py-16">
        <div className="max-w-lg text-center">
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.025em]">
            Workspace
          </h1>
          <p className="mb-0 mt-3 text-sm leading-6 text-black/45">
            Workspace features have been cleared and will be rebuilt from explicit contracts.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

export { WorkspacePage as WorkspaceShell };
