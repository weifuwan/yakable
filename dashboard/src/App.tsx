import { useEffect, useState } from "react";

import {
  listProjects,
  startProjectRuntime,
  type ProjectListItem,
  type RuntimeProject,
} from "./api";
import {
  bootstrapProject,
  readProjectCreationStatus,
  retryProjectCreation,
  watchProjectCreation,
  type ProjectCreationStatus,
} from "./create-project";
import { FrontendAgentActivity } from "./components/FrontendAgentActivity";
import { BuildingWorkspace } from "./pages/BuildingWorkspace";
import { Dashboard } from "./pages/Dashboard";
import type { ActiveProject } from "./pages/Workspace";
import { WorkspaceShell } from "./pages/WorkspaceShell";
import { projectTitle } from "./utils/project";

const PROJECTS_CHANGED_EVENT = "yakable:projects-changed";
const CREATE_FALLBACK_POLL_MS = 800;

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function activeProjectFromRuntime(projectId: string, runtime: RuntimeProject): ActiveProject {
  return {
    id: projectId,
    title: runtime.name || projectTitle(projectId),
    previewUrl: runtime.previewUrl,
    template: runtime.template,
    routes: runtime.routes,
    summary: runtime.session?.initialSummary,
    conversation: runtime.conversation,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export default function App() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<ActiveProject | null>(null);
  const [previewProject, setPreviewProject] = useState<ActiveProject | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [creationStatus, setCreationStatus] = useState<ProjectCreationStatus | null>(null);
  const [pathname, setPathname] = useState(() =>
    normalizePath(window.location.pathname),
  );

  const route = resolveAppRoute(pathname);

  async function reloadProjects() {
    setLoading(true);
    try {
      const nextProjects = await listProjects();
      setProjects(nextProjects);
      setActiveProject((current) => {
        if (!current) return current;
        const updated = nextProjects.find((project) => project.id === current.id);
        return updated ? { ...current, title: updated.name } : current;
      });
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
    function handleProjectsChanged() {
      void reloadProjects().catch((error) => console.error(error));
    }
    window.addEventListener(PROJECTS_CHANGED_EVENT, handleProjectsChanged);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, handleProjectsChanged);
  }, []);

  useEffect(() => {
    const currentRoute = resolveAppRoute(pathname);

    if (currentRoute.kind !== "project") {
      setActiveProject(null);
      setPreviewProject(null);
      setProjectLoading(false);
      setProjectError("");
      setCreationStatus(null);
      return;
    }

    if (activeProject?.id === currentRoute.projectId) {
      setPreviewProject(null);
      setProjectLoading(false);
      setCreationStatus(null);
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();
    setPreviewProject(null);
    setProjectLoading(true);
    setProjectError("");

    async function pollUntilReady(initial: ProjectCreationStatus): Promise<RuntimeProject> {
      let creation = initial;
      while (!cancelled && creation.project.status !== "READY") {
        if (creation.project.status === "FAILED") {
          throw new Error(
            creation.project.failureMessage || "Yakable could not build this project.",
          );
        }
        await delay(CREATE_FALLBACK_POLL_MS);
        if (cancelled) throw new DOMException("Project navigation cancelled.", "AbortError");
        const next = await readProjectCreationStatus(currentRoute.projectId);
        if (!next) {
          throw new Error("Yakable lost the project creation state before it became ready.");
        }
        creation = next;
        setCreationStatus(next);
      }
      if (cancelled) throw new DOMException("Project navigation cancelled.", "AbortError");
      return startProjectRuntime(currentRoute.projectId);
    }

    async function openProject() {
      let creation = await readProjectCreationStatus(currentRoute.projectId);
      if (cancelled) return;
      setCreationStatus(creation);

      if (creation) {
        if (creation.project.status === "FAILED") {
          throw new Error(
            creation.project.failureMessage || "Yakable could not build this project.",
          );
        }

        let runtime: RuntimeProject | null = null;
        if (creation.project.status === "READY") {
          runtime = await startProjectRuntime(currentRoute.projectId);
        } else {
          try {
            runtime = await watchProjectCreation(currentRoute.projectId, {
              initialStatus: creation,
              signal: abortController.signal,
              onStatus(status) {
                if (!cancelled) {
                  creation = status;
                  setCreationStatus(status);
                }
              },
            });
          } catch (error) {
            if (cancelled || isAbortError(error)) return;

            const latest = await readProjectCreationStatus(currentRoute.projectId).catch(() => null);
            if (latest) {
              creation = latest;
              setCreationStatus(latest);
              if (latest.project.status === "FAILED") {
                throw new Error(
                  latest.project.failureMessage ||
                    (error instanceof Error ? error.message : "Yakable could not build this project."),
                );
              }
            }
            console.warn("[Yakable Create] Live stream disconnected; falling back to status polling.", error);
          }
        }

        if (cancelled) return;
        runtime ??= await pollUntilReady(creation);
        if (cancelled) return;
        setPreviewProject(activeProjectFromRuntime(currentRoute.projectId, runtime));
        return;
      }

      const runtime = await startProjectRuntime(currentRoute.projectId);
      if (cancelled) return;
      setActiveProject(activeProjectFromRuntime(currentRoute.projectId, runtime));
      void reloadProjects().catch((error) => console.error(error));
    }

    void openProject()
      .catch((error) => {
        if (cancelled || isAbortError(error)) return;
        setProjectError(
          error instanceof Error ? error.message : "Unable to start project runtime.",
        );
      })
      .finally(() => {
        if (!cancelled) setProjectLoading(false);
      });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [pathname, activeProject?.id]);

  function navigate(path: string) {
    const nextPath = normalizePath(path);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setPathname(nextPath);
  }

  async function handleCreate(prompt: string): Promise<void> {
    const result = await bootstrapProject(prompt);

    setActiveProject(null);
    setPreviewProject(null);
    setProjectError("");
    setCreationStatus(result.creation);
    navigate(projectPath(result.project.id));
  }

  async function handleRetryCreate(projectId: string): Promise<void> {
    const result = await retryProjectCreation(projectId);
    setActiveProject(null);
    setPreviewProject(null);
    setProjectError("");
    setCreationStatus({
      project: {
        ...result.project,
        activeRunId: result.run.id,
      },
      run: result.run,
    });
    navigate(projectPath(result.project.id));
  }

  async function handleOpen(projectId: string) {
    setActiveProject(null);
    setPreviewProject(null);
    setCreationStatus(null);
    setProjectError("");
    navigate(projectPath(projectId));
  }

  function handleWorkspaceNavigate(path: string) {
    setProjectError("");
    setPreviewProject(null);
    setCreationStatus(null);
    navigate(path);
  }

  function handlePreviewReady(projectId: string) {
    if (!previewProject || previewProject.id !== projectId) return;
    setActiveProject(previewProject);
    setPreviewProject(null);
    setCreationStatus(null);
    void reloadProjects().catch((error) => console.error(error));
  }

  if (route.kind === "project") {
    const buildingCreation =
      activeProject?.id !== route.projectId && creationStatus?.project.id === route.projectId
        ? creationStatus
        : null;
    const readyPreview =
      previewProject?.id === route.projectId ? previewProject : null;

    return (
      <>
        {buildingCreation ? (
          <BuildingWorkspace
            projectId={route.projectId}
            projects={projects}
            creation={buildingCreation}
            readyProject={readyPreview}
            error={projectError}
            onRetry={() => handleRetryCreate(route.projectId)}
            onPreviewReady={() => handlePreviewReady(route.projectId)}
            onNavigate={handleWorkspaceNavigate}
          />
        ) : (
          <WorkspaceShell
            project={activeProject}
            projectId={route.projectId}
            projects={projects}
            error={projectError}
            onNavigate={handleWorkspaceNavigate}
          />
        )}
        <FrontendAgentActivity />
      </>
    );
  }

  return (
    <>
      <Dashboard
        projects={projects}
        loading={loading || projectLoading}
        pathname={route.pathname}
        onCreate={handleCreate}
        onOpen={handleOpen}
        onNavigate={navigate}
      />
      <FrontendAgentActivity />
    </>
  );
}
