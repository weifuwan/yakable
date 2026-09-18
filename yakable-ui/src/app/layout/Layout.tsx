import type { ReactNode } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f6f4] text-[#20201e]">
      <header className="flex h-12 items-center border-b border-black/[0.08] px-4">
        <strong className="text-sm font-semibold">Yakable</strong>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
