import { useState } from 'react';

import ChatPanel, { type ChatMessage } from './components/ChatPanel';
import PreviewPanel, { type PreviewViewport } from './components/PreviewPanel';
import WorkspaceHeader from './components/WorkspaceHeader';

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Tell me what you want to build. PR 1 establishes the workspace shell; the coding agent will connect to this conversation in PR 2.',
  },
];

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [viewport, setViewport] = useState<PreviewViewport>('desktop');

  const handleSend = (message: string) => {
    const timestamp = Date.now();

    setMessages((current) => [
      ...current,
      {
        id: `user-${timestamp}`,
        role: 'user',
        content: message,
      },
      {
        id: `assistant-${timestamp}`,
        role: 'assistant',
        content:
          'Prompt captured. The AI Agent is intentionally not wired in this PR yet. The preview on the right demonstrates the workspace boundary it will drive next.',
      },
    ]);
  };

  return (
    <div className="flex h-screen min-h-[640px] flex-col overflow-hidden bg-zinc-100 text-zinc-950">
      <WorkspaceHeader />
      <main className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <ChatPanel messages={messages} onSend={handleSend} />
        <PreviewPanel viewport={viewport} onViewportChange={setViewport} />
      </main>
    </div>
  );
}
