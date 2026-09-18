import { type FormEvent, useEffect, useRef } from "react";

import type { PersistedVisualSelection } from "@/features/project/model/types";
import { Icon } from "@/shared/ui";
import { EditorIcon, roundIconButtonClass } from "./EditorIcon";
import type { ChatMessage } from "./types";
import {
  formatMessageTime,
  sourceLabel,
  SUGGESTION_PROMPTS,
} from "./utils";

function MessageToolbar({ content }: { content: string }) {
  return (
    <div className="mt-1 flex items-center gap-0.5 text-black/45">
      <button className={roundIconButtonClass} type="button" aria-label="Revert this change">
        <Icon name="back" size={13} />
      </button>
      <button className={roundIconButtonClass} type="button" aria-label="Helpful">
        <EditorIcon name="thumbUp" size={13} />
      </button>
      <button className={roundIconButtonClass} type="button" aria-label="Not helpful">
        <EditorIcon name="thumbDown" size={13} />
      </button>
      <button className={roundIconButtonClass} type="button" aria-label="Copy message" onClick={() => void navigator.clipboard?.writeText(content)}>
        <EditorIcon name="copy" size={13} />
      </button>
      <button className={roundIconButtonClass} type="button" aria-label="More options">
        <EditorIcon name="more" size={13} />
      </button>
    </div>
  );
}

function VisualTargetChip({ selection }: { selection: PersistedVisualSelection }) {
  return (
    <span className="group/visual-target relative inline-flex min-h-[22px] items-center gap-1 rounded-[7px] bg-[#e5ecff] px-1.5 pl-1 text-[11px] font-semibold leading-[22px] text-[#2f5de0]">
      <span className="grid h-3.5 w-3.5 place-items-center rounded-[4px] border border-[#4b73ff]/70 text-[8px] font-bold leading-none">T</span>
      <span>{selection.tagName.toLowerCase()}</span>
      <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 -translate-x-1/2 translate-y-0.5 whitespace-nowrap rounded-lg border border-black/[0.12] bg-white px-2.5 py-1.5 text-[11px] font-medium leading-4 text-[#30302d] opacity-0 shadow-[0_5px_16px_rgba(15,23,42,0.12)] transition group-hover/visual-target:translate-y-0 group-hover/visual-target:opacity-100">
        {sourceLabel(selection)}
      </span>
    </span>
  );
}

export function ChatTimeline({ messages, busy }: { messages: ChatMessage[]; busy: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, busy]);

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-3">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-3">
        {messages.map((message, index) => {
          if (message.role === "user") {
            const targets = message.visualSelections ?? [];
            const visibleTargets = targets.slice(0, 3);
            return (
              <div key={message.id || `user-${index}`} className="flex flex-col items-end py-1">
                <div className="max-w-[75%] rounded-[22px] border border-black/[0.08] bg-white px-4 py-3 text-sm leading-6 text-[#30302d] shadow-[0_1px_2px_rgba(15,23,42,0.035)]">
                  {visibleTargets.length ? (
                    <div className="mb-1.5 flex flex-wrap items-center gap-1">
                      {visibleTargets.map((selection, selectionIndex) => (
                        <VisualTargetChip key={`${selection.sourceId ?? selection.selector}-${selectionIndex}`} selection={selection} />
                      ))}
                      {targets.length > visibleTargets.length ? (
                        <span className="inline-flex min-h-[22px] items-center rounded-[7px] bg-[#e5ecff]/75 px-2 text-[11px] font-semibold leading-[22px] text-[#2f5de0]">
                          +{targets.length - visibleTargets.length}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div>{message.content}</div>
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-black/42">
                  <button className="grid h-6 w-6 place-items-center rounded-full border-0 bg-transparent p-0 text-black/45 transition hover:bg-black/[0.045] hover:text-black/70" type="button" aria-label="Copy user message" onClick={() => void navigator.clipboard?.writeText(message.content)}>
                    <EditorIcon name="copy" size={13} />
                  </button>
                  {message.createdAt ? <span>{formatMessageTime(message.createdAt)}</span> : null}
                </div>
              </div>
            );
          }

          if (message.role === "error") {
            return (
              <div key={message.id || `error-${index}`} className="max-w-[86%] rounded-2xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                {message.content}
              </div>
            );
          }

          return (
            <div key={message.id || `assistant-${index}`} className="py-1 text-sm leading-6 text-[#3f3f3b]">
              <button className="mb-1 border-0 bg-transparent p-0 text-[11px] text-black/42" type="button">
                Thought for 1s
              </button>
              <div className="whitespace-pre-wrap">
                {message.content.split("\n").map((line, lineIndex) => (
                  <p className="m-0 min-h-6" key={`${line}-${lineIndex}`}>{line}</p>
                ))}
              </div>
              <MessageToolbar content={message.content} />
            </div>
          );
        })}
        {busy ? (
          <div className="flex items-center gap-2 py-2 text-sm text-black/50">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/15 border-t-black/65" />
            Yakable is updating the project…
          </div>
        ) : null}
        <div ref={endRef} aria-hidden="true" />
      </div>
    </div>
  );
}

export function ChatComposer({
  prompt,
  busy,
  onPromptChange,
  onSubmit,
}: {
  prompt: string;
  busy: boolean;
  onPromptChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <div className="shrink-0 px-3 pb-3">
      <div className="mx-auto w-full">
        <div className="scrollbar-hide mb-2 flex gap-1.5 overflow-x-auto px-1">
          {SUGGESTION_PROMPTS.map((suggestion) => (
            <button
              key={suggestion}
              className="h-7 shrink-0 cursor-pointer rounded-full border border-black/[0.11] bg-white px-3 text-[11px] font-medium text-black/65 shadow-[0_1px_2px_rgba(15,23,42,0.035)] transition hover:bg-black/[0.025] disabled:cursor-default"
              type="button"
              onClick={() => onPromptChange(suggestion)}
              disabled={busy}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form
          className="rounded-[22px] border border-black/[0.09] bg-white p-3 shadow-[0_6px_22px_rgba(15,23,42,0.08)]"
          onSubmit={onSubmit}
        >
          <textarea
            className="min-h-[54px] w-full resize-none border-0 bg-transparent px-1 pb-2 text-sm leading-6 text-[#2e2e2b] outline-none placeholder:text-black/38 disabled:opacity-60"
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder="Ask Yakable..."
            rows={2}
            disabled={busy}
          />

          <div className="flex items-center justify-between gap-2">
            <button
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-full border border-black/[0.11] bg-white text-black/55 transition hover:bg-black/[0.035] disabled:cursor-default"
              type="button"
              aria-label="Add attachment"
              disabled={busy}
            >
              <Icon name="plus" size={15} />
            </button>

            <div className="flex items-center gap-1">
              <button
                className="relative inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-[#20201f] p-0 text-white transition hover:bg-black disabled:cursor-default disabled:opacity-25"
                type="submit"
                aria-label="Send message"
                disabled={!prompt.trim() || busy}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" aria-hidden="true">
                  <path d="M11.0004 19.0005V7.41461L7.70744 10.7076C7.31692 11.0981 6.68391 11.0981 6.29338 10.7076C5.90286 10.3171 5.90286 9.68404 6.29338 9.29352L11.2934 4.29352L11.3666 4.22711C11.5446 4.08128 11.7683 4.00055 12.0004 4.00055C12.2656 4.00055 12.5199 4.10598 12.7074 4.29352L17.7074 9.29352C18.098 9.68404 18.098 10.3171 17.7074 10.7076C17.3169 11.0981 16.6839 11.0981 16.2934 10.7076L13.0004 7.41461V19.0005C13.0004 19.5528 12.5527 20.0005 12.0004 20.0005C11.4481 20.0005 11.0004 19.5528 11.0004 19.0005Z" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
