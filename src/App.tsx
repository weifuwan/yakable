import { useState } from 'react';

import ChatPanel, { type ChatMessage } from './components/ChatPanel';
import PreviewPanel, { type PreviewViewport } from './components/PreviewPanel';
import WorkspaceHeader from './components/WorkspaceHeader';
import { runAgentRequest } from './lib/agent-api';

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Tell me what you want to build. I can now inspect the Yakable workspace and prepare an implementation plan through the server-side Agent loop.',
  },
];

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [viewport, setViewport] = useState<PreviewViewport>('desktop');
  const [isThinking, setIsThinking] = useState(false);

  const handleSend = async (message: string) => {
    if (isThinking) {
      return;
    }

    const timestamp = Date.now();
    const history = messages
      .filter((item) => item.id !== 'welcome')
      .map(({ role, content }) => ({ role, content }));

    setMessages((current) => [
      ...current,
      {
        id: `user-${timestamp}`,
        role: 'user',
        content: message,
      },
    ]);
    setIsThinking(true);

    try {
      const result = await runAgentRequest(message, history);

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${timestamp}`,
          role: 'assistant',
          content: result.message,
        },
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'The Agent request failed.';

      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${timestamp}`,
          role: 'assistant',
          content: `I could not reach the Yakable Agent: ${detail}`,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="flex h-screen min-h-[640px] flex-col overflow-hidden bg-zinc-100 text-zinc-950">
      <WorkspaceHeader />
      <main className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <ChatPanel messages={messages} onSend={handleSend} isThinking={isThinking} />
        <PreviewPanel viewport={viewport} onViewportChange={setViewport} />
      </main>
    </div>
  );
}
