import { useState } from "react";

import type { ProjectListItem } from "../../api";
import { DashboardContent } from "./components/DashboardContent";
import { DashboardLayout } from "./components/DashboardLayout";

export function Dashboard({
  projects,
  loading,
  pathname,
  onCreate,
  onOpen,
  onNavigate,
}: {
  projects: ProjectListItem[];
  loading: boolean;
  pathname: string;
  onCreate: (prompt: string) => Promise<void>;
  onOpen: (id: string) => Promise<void>;
  onNavigate: (path: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function create(prompt: string) {
    setCreating(true);
    setCreateError("");
    try {
      await onCreate(prompt);
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Yakable could not finish this request. Please try again.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <DashboardLayout
      pathname={pathname}
      projects={projects}
      onNavigate={onNavigate}
    >
      <DashboardContent
        pathname={pathname}
        projects={projects}
        loading={loading}
        creating={creating}
        createError={createError}
        onCreate={create}
        onOpen={onOpen}
      />
    </DashboardLayout>
  );
}
