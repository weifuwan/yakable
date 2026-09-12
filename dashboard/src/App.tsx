import { useEffect, useState } from "react";

import {
  createProject,
  listProjects,
  startProjectRuntime,
  type ProjectListItem,
} from "./api";
import { Dashboard } from "./pages/Dashboard";
import { Workspace, type ActiveProject } from "./pages/Workspace";
import { projectTitle } from "./utils/project";

const dashboardPaths = new Set([
  "/dashboard",
  "/dashboard/shared",
  "/dashboard/files",
  "/dashboard/templates",
  "/dashboard/design-systems",
]);

function normalizeDashboardPath(pathname: string): string {
  if (pathname === "/") return "/dashboard";
  return dashboardPaths.has(pathname) ? pathname : "/dashboard";
}

export default function App() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<ActiveProject | null>(null);
  const [pathname, setPathname] = useState(() =>
    normalizeDashboardPath(window.location.pathname),
  );

  async function reloadProjects() {
    setLoading(true);
    try {
      setProjects(await listProjects());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const normalizedPath = normalizeDashboardPath(window.location.pathname);
    if (window.location.pathname !== normalizedPath) {
      window.history.replaceState({}, "", normalizedPath);
    }
    setPathname(normalizedPath);

    function handlePopState() {
      setPathname(normalizeDashboardPath(window.location.pathname));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    void reloadProjects().catch((error) => {
      console.error(error);
      setLoading(false);
    });
  }, []);

  function navigate(path: string) {
    const nextPath = normalizeDashboardPath(path);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setPathname(nextPath);
  }

  async function handleCreate(prompt: string) {
    const result = await createProject(prompt);
    setActiveProject({
      id: result.project.id,
      title: projectTitle(result.project.id),
      previewUrl: result.previewUrl,
      summary: result.project.summary,
      model: result.project.model,
    });
    void reloadProjects();
  }

  async function handleOpen(projectId: string) {
    const runtime = await startProjectRuntime(projectId);
    setActiveProject({
      id: projectId,
      title: projectTitle(projectId),
      previewUrl: runtime.previewUrl,
    });
  }

  if (activeProject) {
    return (
      <Workspace
        project={activeProject}
        onBack={() => {
          setActiveProject(null);
          navigate("/dashboard");
          void reloadProjects();
        }}
      />
    );
  }

  return (
    <Dashboard
      projects={projects}
      loading={loading}
      pathname={pathname}
      onCreate={handleCreate}
      onOpen={handleOpen}
      onNavigate={navigate}
    />
  );
}
