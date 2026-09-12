import { useState } from "react";

import type { ProjectListItem } from "../api";
import { Sidebar } from "../components/Layout";
import { Workspace, type ActiveProject } from "./Workspace";

function projectPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`;
}

export function WorkspaceShell({
  project,
  projects,
  onNavigate,
}: {
  project: ActiveProject;
  projects: ProjectListItem[];
  onNavigate: (path: string) => void;
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);

  function navigate(path: string) {
    setNavigationOpen(false);
    onNavigate(path);
  }

  return (
    <div className="relative h-screen overflow-hidden bg-[#f6f6f4]">
      <Workspace
        project={project}
        onBack={() => setNavigationOpen((value) => !value)}
      />

      {navigationOpen ? (
        <>
          <button
            className="absolute inset-x-0 bottom-0 top-12 z-40 border-0 bg-black/[0.08] p-0"
            type="button"
            aria-label="Close project navigation"
            onClick={() => setNavigationOpen(false)}
          />
          <div className="absolute bottom-0 left-0 top-12 z-50 w-[245px] overflow-hidden border-r border-black/[0.08] bg-[#f5f6f6]">
            <Sidebar
              pathname={projectPath(project.id)}
              onNavigate={navigate}
              projects={projects}
              activeProjectId={project.id}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
