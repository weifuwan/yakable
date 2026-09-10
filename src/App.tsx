import { useState } from 'react';

import ChatPanel, { type ChatMessage } from './components/ChatPanel';
import PreviewPanel, { type PreviewViewport } from './components/PreviewPanel';
import WorkspaceHeader from './components/WorkspaceHeader';
import {
  runAgentRequest,
  type AgentProjectSnapshot,
} from './lib/agent-api';

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Tell me what you want to build. I can now create and edit a real React/Vite/Tailwind project workspace for your request.',
  },
];

function createProjectId() {
  const storageKey = 'yakable.project-id';

  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) {
      return existing;
    }

    const id = `project_${crypto.randomUUID().replaceAll('-', '')}`;
    window.sessionStorage.setItem(storageKey, id);
    return id;
  } catch {
    return `project_${crypto.randomUUID().replaceAll('-', '')}`;
  }
}

export default function App() {
  const [projectId] = useState(createProjectId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [viewport, setViewport] = useState<PreviewViewport>('desktop');
  const [isThinking, setIsThinking] = useState(false);
  const [project, setProject] = useState<AgentProjectSnapshot>();
  const [changedFiles, setChangedFiles] = useState<string[]>([]);

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
    setChangedFiles([]);

    try {
      const result = await runAgentRequest(projectId, message, history);
      setProject(result.project);
      setChangedFiles(result.changedFiles);

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
        <PreviewPanel
          viewport={viewport}
          onViewportChange={setViewport}
          project={project}
          changedFiles={changedFiles}
        />
      </main>
    </div>
  );
}
