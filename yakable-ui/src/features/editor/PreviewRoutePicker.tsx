import { useEffect, useRef, useState } from "react";

import type { ProjectRoute } from "@/features/project/model/types";

export function PreviewRoutePicker({
  routes,
  currentPath,
  onSelect,
}: {
  routes: ProjectRoute[];
  currentPath: string;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeRoute = routes.find((route) => route.path === currentPath) ?? routes[0];

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        className="flex h-6 w-full min-w-0 items-center justify-center gap-1 rounded-full border-0 bg-transparent px-2 text-xs font-medium text-black/65 transition hover:bg-black/[0.035]"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">{activeRoute?.path ?? "/"}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className={`h-3 w-3 shrink-0 opacity-55 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="m7 9 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute left-1/2 top-[calc(100%+8px)] z-50 w-[260px] -translate-x-1/2 overflow-hidden rounded-[14px] border border-black/[0.10] bg-white p-1.5 text-[#242424] shadow-[0_10px_30px_rgba(15,23,42,0.14)]"
          role="menu"
          aria-label="Preview routes"
        >
          <div className="px-2 pb-1.5 pt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-black/35">
            Pages
          </div>
          {routes.map((route) => {
            const selected = route.path === currentPath;
            return (
              <button
                key={route.path}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={`flex w-full items-center gap-2 rounded-[9px] border-0 px-2.5 py-2 text-left transition ${
                  selected ? "bg-black/[0.055]" : "bg-white hover:bg-black/[0.035]"
                }`}
                onClick={() => {
                  onSelect(route.path);
                  setOpen(false);
                }}
              >
                <span className="grid h-4 w-4 shrink-0 place-items-center text-[11px] text-black/50">
                  {selected ? "✓" : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-xs font-medium">{route.path}</strong>
                  <small className="block truncate text-[10px] text-black/40">{route.title}</small>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
