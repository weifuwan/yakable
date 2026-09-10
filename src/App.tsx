import { useState } from 'react';

import ChatPanel, { type ChatMessage } from './components/ChatPanel';
import PreviewPanel, { type PreviewViewport } from './components/PreviewPanel';
import WorkspaceHeader from './components/WorkspaceHeader';
import {
  repairPreviewRuntime,
  runAgentRequest,
  syncPreviewRuntime,
  type AgentProjectSnapshot,
  type AgentRepairSummary,
  type PreviewRuntimeSnapshot,
} from './lib/agent-api';

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Tell me what you want to build, then keep refining it. I edit the same project across turns, validate the live Preview, and automatically repair common generated-code failures.',
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

function repairNote(repair: AgentRepairSummary) {
  if (!repair.attempted) {
    return '';
  }

  if (repair.succeeded) {
    return `\n\nPreview verification found a generated-code issue, so I repaired it automatically in ${repair.attempts} ${repair.attempts === 1 ? 'pass' : 'passes'}.`;
  }

  return `\n\nI tried ${repair.attempts} automatic ${repair.attempts === 1 ? 'repair' : 'repairs'}, but the Preview still reports an error. The source is preserved so we can keep fixing it.`;
}

export default function App() {
  const [projectId] = useState(createProjectId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [viewport, setViewport] = useState<PreviewViewport>('desktop');
  const [isThinking, setIsThinking] = useState(false);
  const [isRefreshingPreview, setIsRefreshingPreview] = useState(false);
  const [project, setProject] = useState<AgentProjectSnapshot>();
  const [runtime, setRuntime] = useState<PreviewRuntimeSnapshot>();
  const [repair, setRepair] = useState<AgentRepairSummary>();
  const [changedFiles, setChangedFiles] = useState<string[]>([]);

  const conversationHistory = () =>
    messages
      .filter((item) => item.id !== 'welcome')
      .map(({ role, content }) => ({ role, content }));

  const handleSend = async (message: string) => {
    if (isThinking) {
      return;
    }

    const timestamp = Date.now();
    const history = conversationHistory();

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
    setRepair(undefined);

    try {
      const result = await runAgentRequest(projectId, message, history);
      setProject(result.project);
      setRuntime(result.runtime);
      setRepair(result.repair);
      setChangedFiles(result.changedFiles);

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${timestamp}`,
          role: 'assistant',
          content: `${result.message}${repairNote(result.repair)}`,
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
      if (runtime?.status === 'error') {
        const result = await repairPreviewRuntime(projectId, conversationHistory());
        setProject(result.project);
        setRuntime(result.runtime);
        setRepair(result.repair);
        setChangedFiles(result.changedFiles);

        if (result.repair.attempted) {
          setMessages((current) => [
            ...current,
            {
              id: `assistant-repair-${Date.now()}`,
              role: 'assistant',
              content: result.repair.succeeded
                ? `I ran another focused repair pass and the Preview is live again after ${result.repair.attempts} ${result.repair.attempts === 1 ? 'attempt' : 'attempts'}.`
                : `I ran ${result.repair.attempts} more repair ${result.repair.attempts === 1 ? 'attempt' : 'attempts'}, but the Preview error is still present.`,
            },
          ]);
        }
        return;
      }

      setRuntime(await syncPreviewRuntime(projectId));
      setRepair(undefined);
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
          repair={repair}
          changedFiles={changedFiles}
          isRefreshing={isRefreshingPreview}
          onRefresh={() => void handleRefreshPreview()}
        />
      </main>
    </div>
  );
}
