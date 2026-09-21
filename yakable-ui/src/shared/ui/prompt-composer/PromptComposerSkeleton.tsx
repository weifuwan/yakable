export function PromptComposerSkeleton() {
  return (
    <div
      className="w-full rounded-[24px] border border-black/[0.10] bg-white p-3"
      role="status"
      aria-label="Loading prompt composer"
      data-testid="prompt-composer-skeleton"
    >
      <div className="min-h-14 px-2 py-1">
        <div className="h-4 w-2/5 animate-pulse rounded-full bg-[#ECECEC]" />
      </div>

      <div className="flex min-h-8 items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="size-8 animate-pulse rounded-full bg-[#ECECEC]" />
          <div className="h-8 w-20 animate-pulse rounded-full bg-[#ECECEC]" />
          <div className="size-8 animate-pulse rounded-full bg-[#ECECEC]" />
        </div>

        <div className="size-8 animate-pulse rounded-full bg-[#ECECEC]" />
      </div>
    </div>
  );
}
