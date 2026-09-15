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

  return (
    <div
      className="group/resize-handle absolute inset-y-0 z-30 w-3 -translate-x-1/2 cursor-col-resize touch-none outline-none max-[900px]:hidden"
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
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors duration-100 ${
          isResizing
            ? "bg-[#4b73ff]"
            : "bg-transparent group-hover/resize-handle:bg-black/[0.16] group-focus-visible/resize-handle:bg-[#4b73ff]/70"
        }`}
      />
    </div>
  );
}
