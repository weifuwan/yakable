import { useState } from "react";

import type { ProjectListItem } from "../api";
import { Sidebar } from "../components/Layout";
import { Workspace, type ActiveProject } from "./Workspace";

function projectPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`;
}

function WorkspaceRouteState({
  projectId,
  error,
}: {
  projectId: string;
  error: string;
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-[#f6f6f4] px-6 font-sans text-[#20201e]">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        {error ? null : (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/15 border-t-black/70" />
        )}
        <strong className="text-sm font-semibold">
          {error ? "Unable to open project" : "Opening project…"}
        </strong>
        <p className={`m-0 text-xs leading-5 ${error ? "text-rose-700" : "text-black/45"}`}>
          {error || projectId}
        </p>
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

  return (
    <div className="flex h-screen min-h-screen overflow-hidden bg-[#f6f6f4]">
      <div
        className={`shrink-0 overflow-hidden border-r border-black/[0.07] bg-[#f5f6f6] transition-[width,border-color] duration-150 ease-out ${
          sidebarCollapsed ? "w-0 border-transparent" : "w-[245px]"
        }`}
      >
        <Sidebar
          pathname={pathname}
          onNavigate={onNavigate}
          projects={projects}
          activeProjectId={projectId}
        />
      </div>

      <div className="min-w-0 flex-1">
        {project?.id === projectId ? (
          <Workspace
            project={project}
            onBack={() => setSidebarCollapsed((value) => !value)}
          />
        ) : (
          <WorkspaceRouteState projectId={projectId} error={error} />
        )}
      </div>
    </div>
  );
}
