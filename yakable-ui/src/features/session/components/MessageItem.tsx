import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import type { SessionMessage } from '@/service/session';
import {
  Button,
  Icon,
  Markdown,
} from '@/shared/ui';

export type MessageRegenerateHandler = (
  message: SessionMessage,
  content: string,
) => void | boolean | Promise<void | boolean>;

const EDIT_TEXTAREA_MIN_HEIGHT = 48;
const EDIT_TEXTAREA_MAX_HEIGHT = 160;
const COMPOSITION_END_DELAY_MS = 50;

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

  return (
    messageDateFormatter.format(date) +
    ' at ' +
    messageTimeFormatter.format(date)
  );
}

function resizeEditTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return;

  element.style.height = 'auto';
  const nextHeight = Math.min(
    Math.max(element.scrollHeight, EDIT_TEXTAREA_MIN_HEIGHT),
    EDIT_TEXTAREA_MAX_HEIGHT,
  );

  element.style.height = `${nextHeight}px`;
  element.style.overflowY =
    element.scrollHeight > EDIT_TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
}

export function MessageItem({
  message,
  onRegenerate,
}: {
  message: SessionMessage;
  onRegenerate?: MessageRegenerateHandler;
}) {
  const isUser = message.role === 'USER';
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  const compositionEndTimerRef = useRef<number | null>(null);

  const clearCompositionEndTimer = useCallback(() => {
    if (compositionEndTimerRef.current === null) return;

    window.clearTimeout(compositionEndTimerRef.current);
    compositionEndTimerRef.current = null;
  }, []);

  useEffect(
    () => () => {
      clearCompositionEndTimer();
    },
    [clearCompositionEndTimer],
  );

  useLayoutEffect(() => {
    if (!isEditing) return;
    resizeEditTextarea(textareaRef.current);
  }, [editedContent, isEditing]);

  if (!isUser) {
    return (
      <div className="flex justify-start" aria-label="Assistant message">
        <div className="max-w-[78%] px-1 py-2">
          <Markdown content={message.content} />
        </div>
      </div>
    );
  }

  const createdAtLabel = formatMessageTime(message.createdAt);
  const normalizedEditedContent = editedContent.trim();
  const canSubmit =
    Boolean(onRegenerate) &&
    normalizedEditedContent.length > 0 &&
    !isSubmitting;

  const handleCopy = () => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(message.content);
  };

  const handleEdit = () => {
    setEditedContent(message.content);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    clearCompositionEndTimer();
    isComposingRef.current = false;
    setEditedContent(message.content);
    setIsEditing(false);
  };

  const handleSubmitEditing = async () => {
    if (!onRegenerate || !canSubmit) return false;

    setIsSubmitting(true);

    try {
      const accepted = await onRegenerate(message, normalizedEditedContent);
      if (accepted === false) return false;

      setIsEditing(false);
      return true;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditInputKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancelEditing();
      return;
    }

    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing ||
      isComposingRef.current
    ) {
      return;
    }

    event.preventDefault();
    void handleSubmitEditing();
  };

  const handleCompositionStart = () => {
    clearCompositionEndTimer();
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    clearCompositionEndTimer();
    compositionEndTimerRef.current = window.setTimeout(() => {
      compositionEndTimerRef.current = null;
      isComposingRef.current = false;
    }, COMPOSITION_END_DELAY_MS);
  };

  return (
    <div className="flex justify-end" aria-label="User message">
      <div
        className={
          isEditing
            ? 'w-full max-w-[78%]'
            : 'group relative max-w-[78%]'
        }
      >
        {isEditing ? (
          <div
            className="rounded-3xl bg-black/[0.06] p-4"
            data-testid="user-message-editor"
          >
            <textarea
              ref={textareaRef}
              autoFocus
              aria-label="Edit user message"
              rows={1}
              value={editedContent}
              onChange={(event) => setEditedContent(event.target.value)}
              onKeyDown={handleEditInputKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              className="block min-h-14 w-full resize-none bg-transparent px-1 py-1 text-sm leading-6 text-[#20201e] outline-none"
            />

            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                size="sm"
                disabled={isSubmitting}
                onClick={handleCancelEditing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!canSubmit}
                onClick={() => {
                  void handleSubmitEditing();
                }}
              >
                Send
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div
              className="rounded-[22px] rounded-br-md border border-[#E1E1E0] bg-white px-4 py-3"
              data-testid="user-message-bubble"
            >
              <Markdown content={message.content} />
            </div>

            <div
              className="pointer-events-none absolute right-0 top-full flex h-6 items-start gap-1.5 pt-1 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
              data-testid="user-message-actions"
            >
              <button
                type="button"
                aria-label="Copy message"
                title="Copy message"
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-black/40 outline-none transition-colors hover:bg-black/[0.05] hover:text-black/65 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black/40"
                onClick={handleCopy}
              >
                <Icon size={14}>
                  <rect x="9" y="9" width="10" height="10" rx="2" />
                  <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                </Icon>
              </button>

              {onRegenerate && (
                <button
                  type="button"
                  aria-label="Edit message"
                  title="Edit message"
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-black/40 outline-none transition-colors hover:bg-black/[0.05] hover:text-black/65 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black/40"
                  onClick={handleEdit}
                >
                  <Icon size={14}>
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                  </Icon>
                </button>
              )}

              {createdAtLabel && (
                <time
                  dateTime={message.createdAt}
                  className="whitespace-nowrap text-xs text-black/35"
                >
                  {createdAtLabel}
                </time>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
