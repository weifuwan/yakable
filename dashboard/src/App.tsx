import { useEffect, useState } from "react";

import {
  createProject,
  listProjects,
  startProjectRuntime,
  type ProjectListItem,
} from "./api";
import { Dashboard } from "./pages/Dashboard";
import type { ActiveProject } from "./pages/Workspace";
import { WorkspaceShell } from "./pages/WorkspaceShell";
import { projectTitle } from "./utils/project";

const dashboardPaths = new Set([
  "/dashboard",
  "/dashboard/all-files",
  "/dashboard/shared",
  "/dashboard/files",
  "/dashboard/templates",
  "/dashboard/design-systems",
  "/dashboard/projects",
  "/dashboard/projects/owned",
  "/dashboard/projects/shared",
]);

type AppRoute =
  | { kind: "dashboard"; pathname: string }
  | { kind: "project"; projectId: string };

function projectPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`;
}

function resolveAppRoute(pathname: string): AppRoute {
  if (pathname === "/") {
    return { kind: "dashboard", pathname: "/dashboard" };
  }

  if (dashboardPaths.has(pathname)) {
    return { kind: "dashboard", pathname };
  }

  const projectMatch = pathname.match(/^\/projects\/([^/]+)\/?$/);
  if (projectMatch?.[1]) {
    try {
      return {
        kind: "project",
        projectId: decodeURIComponent(projectMatch[1]),
      };
    } catch {
      return { kind: "dashboard", pathname: "/dashboard" };
    }
  }

  return { kind: "dashboard", pathname: "/dashboard" };
}

function canonicalPath(route: AppRoute): string {
  return route.kind === "project" ? projectPath(route.projectId) : route.pathname;
}

function normalizePath(pathname: string): string {
  return canonicalPath(resolveAppRoute(pathname));
}

export default function App() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<ActiveProject | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [pathname, setPathname] = useState(() =>
    normalizePath(window.location.pathname),
  );

  const route = resolveAppRoute(pathname);

  async function reloadProjects() {
    setLoading(true);
    try {
      setProjects(await listProjects());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const normalizedPath = normalizePath(window.location.pathname);
    if (window.location.pathname !== normalizedPath) {
      window.history.replaceState({}, "", normalizedPath);
    }
    setPathname(normalizedPath);

    function handlePopState() {
      setPathname(normalizePath(window.location.pathname));
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

  useEffect(() => {
    const currentRoute = resolveAppRoute(pathname);

    if (currentRoute.kind !== "project") {
      setActiveProject(null);
      setProjectLoading(false);
      setProjectError("");
      return;
    }

    if (activeProject?.id === currentRoute.projectId) {
      setProjectLoading(false);
      return;
    }

    let cancelled = false;
    setProjectLoading(true);
    setProjectError("");

    void startProjectRuntime(currentRoute.projectId)
      .then((runtime) => {
        if (cancelled) return;
        setActiveProject({
          id: currentRoute.projectId,
          title: projectTitle(currentRoute.projectId),
          previewUrl: runtime.previewUrl,
          template: runtime.template,
          routes: runtime.routes,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setProjectError(
          error instanceof Error ? error.message : "Unable to start project runtime.",
        );
      })
      .finally(() => {
        if (!cancelled) setProjectLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, activeProject?.id]);

  function navigate(path: string) {
    const nextPath = normalizePath(path);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setPathname(nextPath);
  }

  async function handleCreate(prompt: string) {
    const result = await createProject(prompt);
    const nextProject: ActiveProject = {
      id: result.project.id,
      title: projectTitle(result.project.id),
      previewUrl: result.previewUrl,
      summary: result.project.summary,
      model: result.project.model,
      template: result.project.template,
      routes: result.project.routes,
    };

    setActiveProject(nextProject);
    navigate(projectPath(result.project.id));
    void reloadProjects();
  }

  async function handleOpen(projectId: string) {
    setActiveProject(null);
    setProjectError("");
    navigate(projectPath(projectId));
  }

  function handleWorkspaceNavigate(path: string) {
    setProjectError("");
    navigate(path);
  }

  if (route.kind === "project") {
    return (
      <WorkspaceShell
        project={activeProject}
        projectId={route.projectId}
        projects={projects}
        error={projectError}
        onNavigate={handleWorkspaceNavigate}
      />
    );
  }

  return (
    <Dashboard
      projects={projects}
      loading={loading || projectLoading}
      pathname={route.pathname}
      onCreate={handleCreate}
      onOpen={handleOpen}
      onNavigate={navigate}
    />
  );
}
