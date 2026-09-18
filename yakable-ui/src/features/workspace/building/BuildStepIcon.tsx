import type { BuildStepStatus } from "@/features/workspace/building-state";

export function BuildStepIcon({ status }: { status: BuildStepStatus }) {
  if (status === "complete") {
    return (
      <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[#20201e] text-white">
        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5.5 10.2 2.8 2.8 6.2-6.2" />
        </svg>
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-rose-100 text-rose-700">
        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="m7 7 6 6M13 7l-6 6" />
        </svg>
      </span>
    );
  }

  if (status === "active") {
    return (
      <span className="relative grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-[#6d5dfc]/25 bg-[#6d5dfc]/[0.07]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#6d5dfc]" />
        <span className="absolute inset-[-3px] animate-ping rounded-full border border-[#6d5dfc]/20" />
      </span>
    );
  }

  return (
    <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-black/[0.12] bg-white">
      <span className="h-1 w-1 rounded-full bg-black/20" />
    </span>
  );
}
