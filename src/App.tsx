import { useState } from 'react';

import ChatPanel, { type ChatMessage } from './components/ChatPanel';
import PreviewPanel, { type PreviewViewport } from './components/PreviewPanel';
import WorkspaceHeader from './components/WorkspaceHeader';
import {
  runAgentRequest,
  syncPreviewRuntime,
  type AgentProjectSnapshot,
  type PreviewRuntimeSnapshot,
} from './lib/agent-api';

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Tell me what you want to build. I can generate the React source and run it in Yakable’s controlled live Preview Runtime.',
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
  const [isRefreshingPreview, setIsRefreshingPreview] = useState(false);
  const [project, setProject] = useState<AgentProjectSnapshot>();
  const [runtime, setRuntime] = useState<PreviewRuntimeSnapshot>();
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
      setRuntime(result.runtime);
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

  const handleRefreshPreview = async () => {
    if (!project || isRefreshingPreview) {
      return;
    }

    setIsRefreshingPreview(true);

    try {
      setRuntime(await syncPreviewRuntime(projectId));
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Preview refresh failed.';
      setRuntime((current) => ({
        projectId,
        status: 'error',
        revision: current?.revision ?? 0,
        error: detail,
      }));
    } finally {
      setIsRefreshingPreview(false);
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
          runtime={runtime}
          changedFiles={changedFiles}
          isRefreshing={isRefreshingPreview}
          onRefresh={() => void handleRefreshPreview()}
        />
      </main>
    </div>
  );
}
