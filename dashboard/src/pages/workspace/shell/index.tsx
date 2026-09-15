import { useEffect, useRef, useState } from "react";

import { startProjectRuntime, type ProjectListItem } from "../../../api";
import {
  AgentDetailsPanel,
  extractAgentRunsFromConversation,
  type AgentRunView,
} from "../../../components/AgentDetailsPanel";
import { Sidebar } from "../../../components/Layout";
import { subscribeFrontendAgentProgress } from "../../../frontend-agent";
import { projectTitle } from "../../../utils/project";
import { Workspace } from "../editor";
import type { ActiveProject } from "../editor/types";
import { WorkspaceRouteState } from "./WorkspaceRouteState";

function projectPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`;
}

function isWorkspaceSidebarToggle(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest('button[aria-label="Back to dashboard"]')
    : null;
}

export function WorkspaceShell({
  project,
  projectId,
  projects,
  error,
  onNavigate,
}: {
  project: ActiveProject | null;
  projectId: string;
  projects: ProjectListItem[];
  error: string;
  onNavigate: (path: string) => void;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [peekOpen, setPeekOpen] = useState(false);
  const [agentRuns, setAgentRuns] = useState<AgentRunView[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const showPeekTimer = useRef<number | null>(null);
  const hidePeekTimer = useRef<number | null>(null);
  const refreshSequence = useRef(0);
  const pathname = projectPath(projectId);
  const projectReady = project?.id === projectId;
  const switchingProject = Boolean(project && !projectReady);

  function clearShowPeekTimer() {
    if (showPeekTimer.current !== null) {
      window.clearTimeout(showPeekTimer.current);
      showPeekTimer.current = null;
    }
  }

  function clearHidePeekTimer() {
    if (hidePeekTimer.current !== null) {
      window.clearTimeout(hidePeekTimer.current);
      hidePeekTimer.current = null;
    }
  }

  function schedulePeekOpen() {
    if (!sidebarCollapsed) return;
    clearHidePeekTimer();
    if (peekOpen || showPeekTimer.current !== null) return;
    showPeekTimer.current = window.setTimeout(() => {
      showPeekTimer.current = null;
      setPeekOpen(true);
    }, 190);
  }

  function schedulePeekClose() {
    clearShowPeekTimer();
    clearHidePeekTimer();
    hidePeekTimer.current = window.setTimeout(() => {
      hidePeekTimer.current = null;
      setPeekOpen(false);
    }, 140);
  }

  function keepPeekOpen() {
    clearShowPeekTimer();
    clearHidePeekTimer();
    setPeekOpen(true);
  }

  function closePeek() {
    clearShowPeekTimer();
    clearHidePeekTimer();
    setPeekOpen(false);
  }

  function toggleSidebar() {
    closePeek();
    setSidebarCollapsed((value) => !value);
  }

  function navigateFromPeek(path: string) {
    closePeek();
    onNavigate(path);
  }

  async function refreshAgentRuns() {
    if (!projectReady) return;
    const sequence = ++refreshSequence.current;
    try {
      const runtime = await startProjectRuntime(projectId);
      if (sequence !== refreshSequence.current) return;
      const runs = extractAgentRunsFromConversation(runtime.conversation);
      setAgentRuns(runs);
      setSelectedRunId((current) => {
        if (current && runs.some((run) => run.id === current)) return current;
        return runs[0]?.id ?? null;
      });
    } catch (caught) {
      console.warn("[Yakable Details] Could not refresh persisted agent runs.", caught);
    }
  }

  function openDetails() {
    if (!agentRuns.length) return;
    setSelectedRunId((current) => current ?? agentRuns[0]!.id);
    setDetailsOpen(true);
  }

  useEffect(() => {
    if (!sidebarCollapsed) setPeekOpen(false);
  }, [sidebarCollapsed]);

  useEffect(() => {
    setDetailsOpen(false);
    setAgentRuns([]);
    setSelectedRunId(null);
    if (projectReady) void refreshAgentRuns();
  }, [projectId, projectReady]);

  useEffect(() => {
    if (!projectReady) return;
    let refreshTimer: number | null = null;
    const unsubscribe = subscribeFrontendAgentProgress(({ event }) => {
      if (event.state !== "DONE") return;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void refreshAgentRuns();
      }, 120);
    });

    return () => {
      unsubscribe();
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    };
  }, [projectId, projectReady]);

  useEffect(
    () => () => {
      clearShowPeekTimer();
      clearHidePeekTimer();
      refreshSequence.current += 1;
    },
    [],
  );

  return (
    <div className="relative flex h-screen min-h-screen overflow-hidden bg-[#f6f6f4]">
      <style>{`
        .yakable-workspace-surface button[aria-label="Back to dashboard"] {
          position: relative;
          overflow: hidden;
        }

        .yakable-workspace-surface button[aria-label="Back to dashboard"] > svg {
          transition: opacity 150ms ease-out, transform 150ms ease-out;
        }

        .yakable-workspace-surface button[aria-label="Back to dashboard"]::after {
          content: "";
          position: absolute;
          inset: 0;
          margin: auto;
          width: 15px;
          height: 15px;
          background: currentColor;
          opacity: 0;
          transform: translateX(2px) scale(.9);
          transition: opacity 150ms ease-out, transform 150ms ease-out;
          -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3.5' y='5' width='17' height='14' rx='2'/%3E%3Cpath d='M9 5v14'/%3E%3C/svg%3E") center / 15px 15px no-repeat;
          mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3.5' y='5' width='17' height='14' rx='2'/%3E%3Cpath d='M9 5v14'/%3E%3C/svg%3E") center / 15px 15px no-repeat;
        }

        .yakable-workspace-surface button[aria-label="Back to dashboard"]:hover > svg {
          opacity: 0;
          transform: translateX(-2px) scale(.9);
        }

        .yakable-workspace-surface button[aria-label="Back to dashboard"]:hover::after {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
      `}</style>

      <div
        className={`relative shrink-0 overflow-hidden bg-[#f5f6f6] will-change-[width] transition-[width] duration-[220ms] [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] ${
          sidebarCollapsed ? "w-0" : "w-[245px]"
        }`}
        aria-hidden={sidebarCollapsed}
      >
        <div className="h-full w-[245px]">
          <Sidebar
            pathname={pathname}
            onNavigate={onNavigate}
            projects={projects}
            activeProjectId={projectId}
          />
        </div>
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 w-px bg-black/[0.07] transition-opacity duration-150 ${
            sidebarCollapsed ? "opacity-0" : "opacity-100"
          }`}
          aria-hidden="true"
        />
      </div>

      <div
        className="yakable-workspace-surface relative min-w-0 flex-1 overflow-hidden"
        onPointerOver={(event) => {
          if (!sidebarCollapsed) return;
          if (isWorkspaceSidebarToggle(event.target)) schedulePeekOpen();
        }}
        onPointerOut={(event) => {
          if (!sidebarCollapsed || !isWorkspaceSidebarToggle(event.target)) return;
          if (isWorkspaceSidebarToggle(event.relatedTarget)) return;
          schedulePeekClose();
        }}
      >
        {project ? (
          <div
            className={`h-full transition-[opacity,filter] duration-150 ${
              projectReady ? "opacity-100" : "opacity-55"
            }`}
          >
            <Workspace key={project.id} project={project} onBack={toggleSidebar} />
          </div>
        ) : (
          <WorkspaceRouteState
            projectId={projectId}
            error={error}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={toggleSidebar}
            onPeekEnter={schedulePeekOpen}
            onPeekLeave={schedulePeekClose}
          />
        )}

        {projectReady && agentRuns.length > 0 && !detailsOpen ? (
          <button
            className="absolute right-5 top-[58px] z-[65] inline-flex h-8 items-center gap-1.5 rounded-full border border-black/[0.10] bg-white/95 px-3 text-xs font-medium text-black/62 shadow-[0_4px_14px_rgba(15,23,42,0.08)] backdrop-blur transition hover:bg-white hover:text-black/80"
            type="button"
            onClick={openDetails}
            aria-label="Open agent details"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 5.5h16M4 12h16M4 18.5h10" />
              <circle cx="18" cy="18.5" r="2" />
            </svg>
            Details
            <span className="rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[10px] text-black/42">{agentRuns.length}</span>
          </button>
        ) : null}

        {projectReady && detailsOpen ? (
          <div className="absolute bottom-2 right-2 top-12 z-[75] w-[55%] min-w-[460px] overflow-hidden rounded-2xl border border-black/[0.09] bg-white shadow-[0_12px_38px_rgba(15,23,42,0.14)] max-[900px]:left-2 max-[900px]:w-auto max-[900px]:min-w-0">
            <AgentDetailsPanel
              runs={agentRuns}
              selectedRunId={selectedRunId}
              onSelectRun={setSelectedRunId}
              onClose={() => setDetailsOpen(false)}
            />
          </div>
        ) : null}

        {switchingProject ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#f6f6f4]/35 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/90 px-3 py-2 text-xs font-medium text-black/60 shadow-[0_6px_24px_rgba(15,23,42,0.08)]">
              {error ? null : (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/15 border-t-black/65" />
              )}
              <span>
                {error ? "Unable to open project" : `Opening ${projectTitle(projectId)}…`}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {sidebarCollapsed ? (
        <div
          className={`absolute bottom-2 left-2 top-10 z-[80] w-[245px] overflow-hidden rounded-[18px] border border-black/[0.12] bg-[#f5f6f6] shadow-[0_16px_42px_rgba(15,23,42,0.14)] will-change-transform transition-transform duration-150 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] ${
            peekOpen
              ? "pointer-events-auto translate-x-0"
              : "pointer-events-none -translate-x-[calc(100%+16px)]"
          }`}
          onPointerEnter={keepPeekOpen}
          onPointerLeave={schedulePeekClose}
          aria-hidden={!peekOpen}
        >
          <Sidebar
            pathname={pathname}
            onNavigate={navigateFromPeek}
            projects={projects}
            activeProjectId={projectId}
          />
        </div>
      ) : null}
    </div>
  );
}
