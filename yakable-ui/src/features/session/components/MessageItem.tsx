import type { SessionMessage } from '@/service/session';
import {
  Icon,
  Markdown,
} from '@/shared/ui';

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

export function MessageItem({
  message,
  onEdit,
}: {
  message: SessionMessage;
  onEdit?: (message: SessionMessage) => void;
}) {
  const isUser = message.role === 'USER';

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

  const handleCopy = () => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(message.content);
  };

  return (
    <div className="flex justify-end" aria-label="User message">
      <div className="group relative max-w-[78%]">
        <div className="rounded-2xl rounded-br-md bg-black/[0.06] px-4 py-3">
          <Markdown content={message.content} />
        </div>

        <div
          className="pointer-events-none absolute right-0 top-full mt-1 flex h-5 items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
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

          {onEdit && (
            <button
              type="button"
              aria-label="Edit message"
              title="Edit message"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-black/40 outline-none transition-colors hover:bg-black/[0.05] hover:text-black/65 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black/40"
              onClick={() => onEdit(message)}
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
      </div>
    </div>
  );
}
