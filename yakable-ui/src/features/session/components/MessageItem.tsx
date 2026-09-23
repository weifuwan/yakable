import { useCallback, useEffect, useRef, useState } from 'react';

import type { SessionMessage } from '@/service/session';
import { Icon, Markdown } from '@/shared/ui';

const COPY_FEEDBACK_DURATION_MS = 1800;

const messageDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const messageTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function formatMessageTime(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;

  return messageDateFormatter.format(date) + ' at ' + messageTimeFormatter.format(date);
}

function CopyStatusIcon({ copied }: { copied: boolean }) {
  return (
    <span
      data-testid="copy-message-icon"
      data-copied={copied ? 'true' : 'false'}
      className="relative block size-4"
      aria-hidden="true"
    >
      <Icon
        size={16}
        className={
          'absolute inset-0 transition-all duration-150 ease-out ' +
          (copied ? 'scale-90 opacity-0' : 'scale-100 opacity-100')
        }
      >
        <rect x="9" y="9" width="10" height="10" rx="2" />
        <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      </Icon>

      <Icon
        size={16}
        strokeWidth={1.8}
        className={
          'absolute inset-0 text-success transition-all duration-150 ease-out ' +
          (copied ? 'scale-100 opacity-100' : 'scale-90 opacity-0')
        }
      >
        <circle cx="12" cy="12" r="8.5" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </Icon>
    </span>
  );
}

export function MessageItem({ message }: { message: SessionMessage }) {
  const isUser = message.role === 'USER';
  const [copied, setCopied] = useState(false);
  const copyFeedbackTimerRef = useRef<number | null>(null);

  const clearCopyFeedbackTimer = useCallback(() => {
    if (copyFeedbackTimerRef.current === null) return;

    window.clearTimeout(copyFeedbackTimerRef.current);
    copyFeedbackTimerRef.current = null;
  }, []);

  useEffect(
    () => () => {
      clearCopyFeedbackTimer();
    },
    [clearCopyFeedbackTimer],
  );

  if (!isUser) {
    return (
      <div className="flex w-full justify-start" aria-label="Assistant message">
        <div className="w-full min-w-0 px-1 py-2" data-testid="assistant-message-content">
          <Markdown content={message.content} />
        </div>
      </div>
    );
  }

  const createdAtLabel = formatMessageTime(message.createdAt);

  const handleCopy = () => {
    if (!navigator.clipboard) return;

    void navigator.clipboard
      .writeText(message.content)
      .then(() => {
        clearCopyFeedbackTimer();
        setCopied(true);

        copyFeedbackTimerRef.current = window.setTimeout(() => {
          copyFeedbackTimerRef.current = null;
          setCopied(false);
        }, COPY_FEEDBACK_DURATION_MS);
      })
      .catch(() => {
        // Clipboard permission or availability can fail silently.
      });
  };

  return (
    <div className="group flex w-full justify-end" aria-label="User message">
      <div className="relative max-w-[78%]">
        <div
          className="rounded-[22px] rounded-br-md border border-message-border bg-surface px-4 py-3"
          data-testid="user-message-bubble"
        >
          <Markdown content={message.content} />
        </div>

        <div
          className="pointer-events-none absolute right-0 top-full flex h-7 items-center gap-1.5 pt-1 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
          data-testid="user-message-actions"
        >
          <button
            type="button"
            aria-label="Copy message"
            title="Copy message"
            className="relative inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-icon-muted outline-none transition-colors hover:bg-surface-hover hover:text-icon-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring"
            onClick={handleCopy}
          >
            {copied && (
              <output
                data-allow-shadow="true"
                className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border-quiet bg-surface px-2.5 py-1 text-xs font-medium text-foreground shadow-sm"
              >
                Copied
              </output>
            )}

            <CopyStatusIcon copied={copied} />
          </button>

          {createdAtLabel && (
            <time
              dateTime={message.createdAt}
              className="whitespace-nowrap text-[13px] leading-6 text-icon-muted"
            >
              {createdAtLabel}
            </time>
          )}
        </div>
      </div>
    </div>
  );
}
