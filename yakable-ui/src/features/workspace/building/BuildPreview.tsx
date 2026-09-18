import { useEffect, useRef, useState } from "react";

import type { ActiveProject } from "@/features/editor/types";

export function BuildPreview({
  title,
  eyebrow,
  detail,
  failed,
  readyProject,
  onPreviewReady,
}: {
  title: string;
  eyebrow: string;
  detail: string;
  failed: boolean;
  readyProject: ActiveProject | null;
  onPreviewReady: () => void;
}) {
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const handoffTimer = useRef<number | null>(null);

  useEffect(() => {
    setPreviewLoaded(false);
    if (handoffTimer.current !== null) {
      window.clearTimeout(handoffTimer.current);
      handoffTimer.current = null;
    }
    return () => {
      if (handoffTimer.current !== null) window.clearTimeout(handoffTimer.current);
    };
  }, [readyProject?.previewUrl]);

  function handlePreviewLoad() {
    if (!readyProject) return;
    setPreviewLoaded(true);
    if (handoffTimer.current !== null) window.clearTimeout(handoffTimer.current);
    handoffTimer.current = window.setTimeout(() => {
      handoffTimer.current = null;
      onPreviewReady();
    }, 320);
  }

  const statusTitle = readyProject
    ? previewLoaded
      ? "Preview ready"
      : "Opening your preview"
    : title;
  const statusEyebrow = readyProject ? "Live preview" : eyebrow;
  const statusDetail = readyProject
    ? previewLoaded
      ? "Your first version is live. Opening the editor now."
      : "The runtime is ready. Connecting the first interactive preview."
    : detail;

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#f3f3f1]">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-black/[0.08] bg-white px-4">
        <div className="inline-flex h-8 items-center gap-1 rounded-lg bg-black/[0.045] p-1 text-xs font-medium text-black/70">
          <span className="rounded-md bg-white px-2.5 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.08)]">Preview</span>
          <span className="px-2.5 py-1 text-black/32">Code</span>
        </div>
        <div className="flex items-center gap-2 text-black/25">
          <span className="h-7 w-7 rounded-lg border border-black/[0.07] bg-white" />
          <span className="h-7 w-16 rounded-lg border border-black/[0.07] bg-white" />
        </div>
      </div>

      <div className="relative min-h-0 flex-1 p-4 max-[1100px]:p-3">
        <div className="relative h-full overflow-hidden rounded-xl border border-black/[0.09] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex h-9 items-center gap-2 border-b border-black/[0.07] bg-[#fbfbfa] px-3">
            <span className="h-2.5 w-2.5 rounded-full bg-black/[0.09]" />
            <span className="h-2.5 w-2.5 rounded-full bg-black/[0.09]" />
            <span className="h-2.5 w-2.5 rounded-full bg-black/[0.09]" />
            <span className="ml-2 h-5 max-w-[260px] flex-1 rounded-md bg-black/[0.045]" />
          </div>

          <div
            className={`absolute inset-x-0 bottom-0 top-9 overflow-hidden p-[7%] transition-opacity duration-300 ${
              readyProject ? "opacity-20" : "opacity-100"
            }`}
          >
            <div className="yakable-build-shimmer h-3 w-16 rounded-full" />
            <div className="yakable-build-shimmer mt-6 h-8 w-[64%] max-w-[460px] rounded-lg" />
            <div className="yakable-build-shimmer mt-3 h-8 w-[48%] max-w-[350px] rounded-lg" />
            <div className="yakable-build-shimmer mt-5 h-3 w-[58%] max-w-[420px] rounded-md" />
            <div className="yakable-build-shimmer mt-2 h-3 w-[45%] max-w-[330px] rounded-md" />
            <div className="mt-7 flex gap-3">
              <div className="yakable-build-shimmer h-9 w-24 rounded-lg" />
              <div className="yakable-build-shimmer h-9 w-24 rounded-lg opacity-65" />
            </div>
            <div className="mt-12 grid grid-cols-3 gap-4 max-[1150px]:grid-cols-2">
              <div className="yakable-build-shimmer h-28 rounded-xl opacity-75" />
              <div className="yakable-build-shimmer h-28 rounded-xl opacity-60" />
              <div className="yakable-build-shimmer h-28 rounded-xl opacity-45 max-[1150px]:hidden" />
            </div>
          </div>

          {readyProject ? (
            <iframe
              key={readyProject.previewUrl}
              className={`pointer-events-none absolute inset-x-0 bottom-0 top-9 h-[calc(100%_-_2.25rem)] w-full border-0 bg-white transition-[opacity,transform] duration-300 ease-out ${
                previewLoaded ? "scale-100 opacity-100" : "scale-[0.997] opacity-0"
              }`}
              src={readyProject.previewUrl}
              title={`${readyProject.title} preview`}
              onLoad={handlePreviewLoad}
            />
          ) : null}

          <div
            className={`absolute inset-0 flex items-end justify-center bg-gradient-to-b from-transparent via-transparent to-white/90 p-6 transition-opacity duration-200 ${
              previewLoaded ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          >
            <div className={`flex max-w-[440px] items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_10px_30px_rgba(20,20,18,0.08)] backdrop-blur-md ${failed ? "border-rose-200 bg-rose-50/95" : "border-black/[0.08] bg-white/95"}`}>
              {failed ? (
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-700">
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="m7 7 6 6M13 7l-6 6" />
                  </svg>
                </span>
              ) : readyProject && previewLoaded ? (
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5.5 10.2 2.8 2.8 6.2-6.2" />
                  </svg>
                </span>
              ) : (
                <span className="mt-0.5 h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-black/10 border-t-[#6d5dfc]" />
              )}
              <div className="min-w-0">
                <div className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${failed ? "text-rose-600" : "text-[#6d5dfc]"}`}>{statusEyebrow}</div>
                <div className="mt-0.5 text-sm font-semibold text-[#20201e]">{statusTitle}</div>
                <p className={`mb-0 mt-1 text-xs leading-5 ${failed ? "text-rose-700/75" : "text-black/45"}`}>{statusDetail}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
