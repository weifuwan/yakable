import { Circle, Cloud, MoreHorizontal } from 'lucide-react';

export default function WorkspaceHeader() {
  return (
    <header className="flex h-14 flex-none items-center justify-between border-b border-zinc-200 bg-white px-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 flex-none items-center justify-center rounded-xl bg-zinc-950 text-sm font-bold tracking-[-0.03em] text-white">
          Y
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-[-0.02em] text-zinc-950">Yakable</span>
            <span className="hidden rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 sm:inline-flex">
              MVP
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <span className="truncate">Untitled project</span>
            <Circle size={3} fill="currentColor" strokeWidth={0} />
            <span>workspace shell</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 sm:flex">
          <Cloud size={13} strokeWidth={1.8} />
          Local prototype
        </div>
        <button
          type="button"
          disabled
          title="Publishing will be added after the build and sandbox loop"
          className="hidden rounded-lg bg-zinc-200 px-3 py-1.5 text-[11px] font-semibold text-zinc-400 sm:block"
        >
          Publish
        </button>
        <button
          type="button"
          aria-label="More options"
          className="flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
        >
          <MoreHorizontal size={17} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}
