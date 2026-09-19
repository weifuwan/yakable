import { useEffect, useState } from 'react';

import { isAbortError } from '@/shared/api';
import { PromptComposer } from '@/shared/ui';

import {
  getConversationMessages,
  sendConversationMessage,
} from '../api/conversation-api';
import type { ConversationMessage } from '../types';
import { ConversationMessageItem } from './ConversationMessageItem';

export function ConversationWorkspace({
  initialCreatedAt,
  initialPrompt,
  projectId,
}: {
  initialCreatedAt: string;
  initialPrompt: string;
  projectId: string;
}) {
  const [messages, setMessages] = useState<ConversationMessage[]>([
    {
      id: 'initial-' + projectId,
      role: 'USER',
      content: initialPrompt,
      createdAt: initialCreatedAt,
    },
  ]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const result = await getConversationMessages(
          projectId,
          controller.signal,
        );

        if (controller.signal.aborted) return;

        if (result.length > 0) {
          setMessages(result);
          setLoadError(null);
          return;
        }

        const initialTurn = await sendConversationMessage(
          projectId,
          initialPrompt,
          controller.signal,
        );

        if (controller.signal.aborted) return;

        setMessages([
          initialTurn.userMessage,
          initialTurn.assistantMessage,
        ]);
        setLoadError(null);
      } catch (requestError: unknown) {
        if (isAbortError(requestError, controller.signal)) return;

        setLoadError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load conversation.',
        );
      }
    })();

    return () => {
      controller.abort();
    };
  }, [initialPrompt, projectId]);

  const handleSubmit = async (content: string) => {
    setSendError(null);

    try {
      const turn = await sendConversationMessage(projectId, content);
      setMessages((current) => [
        ...current,
        turn.userMessage,
        turn.assistantMessage,
      ]);
      return true;
    } catch (requestError) {
      setSendError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to send message.',
      );
      return false;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
          {loadError && (
            <div
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              role="alert"
            >
              {loadError}
            </div>
          )}

          {messages.map((message) => (
            <ConversationMessageItem key={message.id} message={message} />
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-black/[0.06] bg-white px-6 py-4">
        <div className="mx-auto w-full max-w-3xl">
          <PromptComposer
            ariaLabel="Send a message"
            placeholder="Ask Yakable..."
            submitLabel="Send message"
            submitTooltip="Send prompt"
            onSubmit={handleSubmit}
          />

          {sendError && (
            <p className="mb-0 mt-2 px-2 text-sm text-red-600" role="alert">
              {sendError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
