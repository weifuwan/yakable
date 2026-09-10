import { useEffect, useState } from 'react';

import ChatPanel, { type ChatMessage } from './components/ChatPanel';
import PreviewPanel, { type PreviewViewport } from './components/PreviewPanel';
import WorkspaceHeader from './components/WorkspaceHeader';
import {
  listProjectVersions,
  repairPreviewRuntime,
  rollbackProjectVersion,
  runAgentRequest,
  syncPreviewRuntime,
  type AgentProjectSnapshot,
  type AgentRepairSummary,
  type PreviewRuntimeSnapshot,
  type ProjectVersionSummary,
} from './lib/agent-api';

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Tell me what you want to build, then keep refining it. I edit the same project across turns, validate the live Preview, automatically repair common generated-code failures, and keep stable versions you can roll back to.',
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
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [project, setProject] = useState<AgentProjectSnapshot>();
  const [runtime, setRuntime] = useState<PreviewRuntimeSnapshot>();
  const [repair, setRepair] = useState<AgentRepairSummary>();
  const [changedFiles, setChangedFiles] = useState<string[]>([]);
  const [versions, setVersions] = useState<ProjectVersionSummary[]>([]);
  const currentVersionId = versions[0]?.id;

  useEffect(() => {
    let cancelled = false;

    void listProjectVersions(projectId)
      .then((items) => {
        if (!cancelled) {
          setVersions(items);
        }
      })
      .catch(() => {
        // A fresh in-memory project has no version history yet.
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

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
      setVersions(result.versions);

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
        setVersions(result.versions);

        if (result.repair.attempted) {
          setMessages((current) => [
            ...current,
            {
              id: `assistant-repair-${Date.now()}`,
              role: 'assistant',
              content: result.repair.succeeded
                ? `I ran another focused repair pass and the Preview is live again after ${result.repair.attempts} ${result.repair.attempts === 1 ? 'attempt' : 'attempts'}. A stable version was saved.`
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

  const handleRollback = async (target: ProjectVersionSummary) => {
    if (isRollingBack) {
      return;
    }

    setIsRollingBack(true);
    setRepair(undefined);

    try {
      const result = await rollbackProjectVersion(projectId, target.id);
      setProject(result.project);
      setRuntime(result.runtime);
      setChangedFiles(result.changedFiles);
      setVersions(result.versions);

      setMessages((current) => [
        ...current,
        {
          id: `assistant-rollback-${Date.now()}`,
          role: 'assistant',
          content:
            result.runtime.status === 'ready'
              ? `Rolled the project back to v${target.number}. Yakable saved the rollback as a new stable version, so the later history is still available.`
              : `Restored the source from v${target.number}, but the Preview runtime could not validate it: ${result.runtime.error ?? 'unknown runtime error'}`,
        },
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Version rollback failed.';
      setMessages((current) => [
        ...current,
        {
          id: `assistant-rollback-error-${Date.now()}`,
          role: 'assistant',
          content: `I could not roll back that version: ${detail}`,
        },
      ]);
    } finally {
      setIsRollingBack(false);
    }
  };

  return (
    <div className="flex h-screen min-h-[640px] flex-col overflow-hidden bg-zinc-100 text-zinc-950">
      <WorkspaceHeader />
      <main className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <ChatPanel messages={messages} onSend={handleSend} isThinking={isThinking} />
        <PreviewPanel
          projectId={projectId}
          viewport={viewport}
          onViewportChange={setViewport}
          project={project}
          runtime={runtime}
          repair={repair}
          changedFiles={changedFiles}
          versions={versions}
          currentVersionId={currentVersionId}
          isRefreshing={isRefreshingPreview}
          isRollingBack={isRollingBack}
          onRefresh={() => void handleRefreshPreview()}
          onRollback={(version) => void handleRollback(version)}
        />
      </main>
    </div>
  );
}
