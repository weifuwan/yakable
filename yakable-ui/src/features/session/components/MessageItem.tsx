import type { SessionMessage } from '@/service/session';
import { Markdown } from '@/shared/ui';

export function MessageItem({
  message,
}: {
  message: SessionMessage;
}) {
  const isUser = message.role === 'USER';

  return (
    <div
      className={isUser ? 'flex justify-end' : 'flex justify-start'}
      aria-label={isUser ? 'User message' : 'Assistant message'}
    >
      <div
        className={
          isUser
            ? 'max-w-[78%] rounded-2xl rounded-br-md bg-black/[0.06] px-4 py-3'
            : 'max-w-[78%] px-1 py-2'
        }
      >
        <Markdown content={message.content} />
      </div>
    </div>
  );
}
