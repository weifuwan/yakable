import { useEffect, useRef, useState } from "react";

import type { ProjectListItem } from "../api";
import { Sidebar } from "../components/Layout";
import { Icon } from "../components/ui";
import { projectTitle } from "../utils/project";
import { Workspace, type ActiveProject } from "./Workspace";

function projectPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`;
}

function WorkspaceRouteState({
  projectId,
  error,
  sidebarCollapsed,
  onToggleSidebar,
  onPeekEnter,
  onPeekLeave,
}: {
  projectId: string;
  error: string;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onPeekEnter: () => void;
  onPeekLeave: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f6f6f4] font-sans text-[#20201e]">
      <div className="flex h-12 shrink-0 items-center gap-2 px-2">
        <button
          className="group relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border-0 bg-transparent text-black/55 transition-colors duration-150 hover:bg-black/[0.05] hover:text-black"
          type="button"
          aria-label={sidebarCollapsed ? "Expand project sidebar" : "Collapse project sidebar"}
          onClick={onToggleSidebar}
          onPointerEnter={sidebarCollapsed ? onPeekEnter : undefined}
          onPointerLeave={sidebarCollapsed ? onPeekLeave : undefined}
        >
          <span className="absolute inset-0 grid place-items-center transition-all duration-150 ease-out group-hover:-translate-x-0.5 group-hover:scale-90 group-hover:opacity-0">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 7h14M5 12h14M5 17h14" />
            </svg>
          </span>
          <span className="absolute inset-0 grid translate-x-0.5 scale-90 place-items-center opacity-0 transition-all duration-150 ease-out group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100">
            <Icon name="panel" size={15} />
          </span>
        </button>
        <strong className="truncate text-sm font-medium text-black/75">
          {projectTitle(projectId)}
        </strong>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          {error ? null : (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/15 border-t-black/70" />
          )}
          <strong className="text-sm font-semibold">
            {error ? "Unable to open project" : "Opening project…"}
          </strong>
          <p
            className={`m-0 text-xs leading-5 ${
              error ? "text-rose-700" : "text-black/45"
            }`}
          >
            {error || projectId}
          </p>
        </div>
      </div>
    </div>
  );
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
  const showPeekTimer = useRef<number | null>(null);
  const hidePeekTimer = useRef<number | null>(null);
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
    }, 150);
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

  useEffect(() => {
    if (!sidebarCollapsed) setPeekOpen(false);
  }, [sidebarCollapsed]);

  useEffect(
    () => () => {
      clearShowPeekTimer();
      clearHidePeekTimer();
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
            <Workspace
              key={project.id}
              project={project}
              onBack={toggleSidebar}
            />
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
          className={`absolute bottom-2 left-2 top-10 z-[80] w-[245px] origin-top-left overflow-hidden rounded-[18px] border border-black/[0.12] bg-[#f5f6f6] shadow-[0_16px_42px_rgba(15,23,42,0.14)] transition-[opacity,transform] duration-150 ease-out ${
            peekOpen
              ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
              : "pointer-events-none -translate-y-1 scale-[0.985] opacity-0"
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
