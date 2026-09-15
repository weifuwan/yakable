import type { Dispatch, KeyboardEvent, SetStateAction } from "react";

import {
  DEFAULT_CHAT_WIDTH,
  MAX_CHAT_WIDTH,
  MIN_CHAT_WIDTH,
  clampChatWidth,
} from "./utils";

export function WorkspaceResizer({
  chatWidth,
  isResizing,
  setChatWidth,
  onResizeStart,
  onCollapsePreview,
}: {
  chatWidth: number;
  isResizing: boolean;
  setChatWidth: Dispatch<SetStateAction<number>>;
  onResizeStart: () => void;
  onCollapsePreview: () => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setChatWidth((current) => clampChatWidth(current - 1));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (chatWidth >= MAX_CHAT_WIDTH) {
        onCollapsePreview();
        return;
      }
      setChatWidth((current) => clampChatWidth(current + 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setChatWidth(MIN_CHAT_WIDTH);
    } else if (event.key === "End") {
      event.preventDefault();
      onCollapsePreview();
    }
  }

  const maskImage =
    "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 5%, rgba(0,0,0,0.5) 11%, black 18%, black 82%, rgba(0,0,0,0.5) 89%, rgba(0,0,0,0.15) 95%, transparent 100%)";

  return (
    <div
      className="group/resize-handle absolute inset-y-0 z-30 flex w-3 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center outline-none max-[900px]:hidden"
      style={{ left: `${chatWidth}%` }}
      role="separator"
      aria-label="Resize chat and preview panels"
      aria-orientation="vertical"
      aria-valuemin={MIN_CHAT_WIDTH}
      aria-valuemax={100}
      aria-valuenow={Math.round(chatWidth)}
      aria-valuetext={`${Math.round(chatWidth)}% chat, ${Math.round(100 - chatWidth)}% preview`}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        onResizeStart();
      }}
      onDoubleClick={() => setChatWidth(DEFAULT_CHAT_WIDTH)}
      onKeyDown={handleKeyDown}
    >
      <span
        className={`pointer-events-none absolute inset-y-3 left-1/2 w-[7px] -translate-x-1/2 rounded-full transition-[opacity,filter] duration-200 ${
          isResizing
            ? "opacity-100"
            : "opacity-70 group-hover/resize-handle:opacity-100 group-focus-visible/resize-handle:opacity-100"
        }`}
        style={{
          backgroundImage: isResizing
            ? "linear-gradient(to right, rgba(75,115,255,0.16) 0 3px, rgba(47,111,237,0.92) 3px 4px, rgba(75,115,255,0.16) 4px 7px)"
            : "linear-gradient(to right, rgba(75,115,255,0.08) 0 3px, rgba(70,76,84,0.68) 3px 4px, rgba(75,115,255,0.08) 4px 7px)",
          WebkitMaskImage: maskImage,
          maskImage,
          filter: isResizing
            ? "drop-shadow(0 0 5px rgba(75,115,255,0.32))"
            : "drop-shadow(0 0 3px rgba(75,115,255,0.14))",
        }}
      />
    </div>
  );
}
