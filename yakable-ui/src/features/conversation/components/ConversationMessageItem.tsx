import type { ConversationMessage } from '../types';

export function ConversationMessageItem({
  message,
}: {
  message: ConversationMessage;
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
        <p className="m-0 whitespace-pre-wrap text-[15px] leading-7 text-[#20201e]">
          {message.content}
        </p>
      </div>
    </div>
  );
}
