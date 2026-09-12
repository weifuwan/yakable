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

export default function App() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<ActiveProject | null>(
    null,
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
    void reloadProjects().catch((error) => {
      console.error(error);
      setLoading(false);
    });
  }, []);

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
          void reloadProjects();
        }}
      />
    );
  }

  return (
    <Dashboard
      projects={projects}
      loading={loading}
      onCreate={handleCreate}
      onOpen={handleOpen}
    />
  );
}
