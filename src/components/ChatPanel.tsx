import {
  ArrowUp,
  LoaderCircle,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import {
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isThinking?: boolean;
}

const suggestions = [
  'Build a modern SaaS landing page',
  'Create a clean analytics dashboard',
];

export default function ChatPanel({
  messages,
  onSend,
  isThinking = false,
}: ChatPanelProps) {
  const [draft, setDraft] = useState('');

  const submit = () => {
    const message = draft.trim();

    if (!message || isThinking) {
      return;
    }

    onSend(message);
    setDraft('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <aside className="flex h-[46vh] min-h-0 flex-col border-b border-zinc-200 bg-white xl:h-full xl:w-[420px] xl:flex-none xl:border-b-0 xl:border-r">
      <div className="border-b border-zinc-100 px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <WandSparkles size={16} strokeWidth={1.9} />
          Build with Yakable
        </div>
        <p className="mt-1 text-xs leading-5 text-zinc-500">
          Describe the product. The Agent edits the project and Yakable refreshes a controlled live Preview.
        </p>
      </div>

      <div className="yakable-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' ? (
                <div className="flex max-w-[92%] items-start gap-2.5">
                  <div className="mt-0.5 flex size-7 flex-none items-center justify-center rounded-lg bg-zinc-950 text-white">
                    <Sparkles size={14} strokeWidth={1.9} />
                  </div>
                  <div className="whitespace-pre-wrap rounded-2xl rounded-tl-md border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-[13px] leading-5 text-zinc-700">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div className="max-w-[86%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-zinc-950 px-3.5 py-3 text-[13px] leading-5 text-white">
                  {message.content}
                </div>
              )}
            </div>
          ))}

          {isThinking ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 flex-none items-center justify-center rounded-lg bg-zinc-950 text-white">
                  <LoaderCircle className="animate-spin" size={14} strokeWidth={1.9} />
                </div>
                <div className="rounded-2xl rounded-tl-md border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[12px] text-zinc-500">
                  Agent is building and preparing the preview...
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-zinc-100 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={isThinking}
              onClick={() => setDraft(suggestion)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-[0_12px_35px_rgba(24,24,27,0.07)] transition focus-within:border-zinc-300 focus-within:shadow-[0_16px_40px_rgba(24,24,27,0.09)]"
        >
          <textarea
            value={draft}
            disabled={isThinking}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder="Describe what you want to build..."
            className="block w-full resize-none border-0 bg-transparent px-2 py-1.5 text-[13px] leading-5 text-zinc-900 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:text-zinc-400"
          />
          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-[10px] text-zinc-400">Enter to send · Shift + Enter for newline</span>
            <button
              type="submit"
              disabled={!draft.trim() || isThinking}
              aria-label="Send prompt"
              className="flex size-8 items-center justify-center rounded-xl bg-zinc-950 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
            >
              {isThinking ? (
                <LoaderCircle className="animate-spin" size={16} strokeWidth={2} />
              ) : (
                <ArrowUp size={16} strokeWidth={2} />
              )}
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}
