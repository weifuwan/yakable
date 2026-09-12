import { useState } from "react";

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
  onToggleSidebar,
}: {
  projectId: string;
  error: string;
  onToggleSidebar: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f6f6f4] font-sans text-[#20201e]">
      <div className="flex h-12 shrink-0 items-center gap-2 px-2">
        <button
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-0 bg-transparent text-black/55 transition hover:bg-black/[0.05] hover:text-black"
          type="button"
          aria-label="Toggle project sidebar"
          onClick={onToggleSidebar}
        >
          <Icon name="panel" size={15} />
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
  const pathname = projectPath(projectId);
  const projectReady = project?.id === projectId;
  const switchingProject = Boolean(project && !projectReady);

  function toggleSidebar() {
    setSidebarCollapsed((value) => !value);
  }

  return (
    <div className="flex h-screen min-h-screen overflow-hidden bg-[#f6f6f4]">
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

      <div className="relative min-w-0 flex-1 overflow-hidden">
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
            onToggleSidebar={toggleSidebar}
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
    </div>
  );
}
