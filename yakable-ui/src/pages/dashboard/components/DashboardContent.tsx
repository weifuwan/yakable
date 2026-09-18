import type { ProjectListItem } from "@/features/project/model/types";
import { ProjectGallery } from "@/features/project/components/ProjectGallery";
import { AllFiles } from "../views/AllFiles";
import { DesignSystemsPage } from "../views/DesignSystems";
import { FilesPage } from "../views/Files";
import { SharedPage } from "../views/Shared";
import { TemplatesPage } from "../views/Templates";
import { DashboardHome } from "./DashboardHome";

export function DashboardContent({
  pathname,
  projects,
  loading,
  creating,
  createError,
  onCreate,
  onOpen,
}: {
  pathname: string;
  projects: ProjectListItem[];
  loading: boolean;
  creating: boolean;
  createError: string;
  onCreate: (prompt: string) => Promise<void>;
  onOpen: (id: string) => Promise<void>;
}) {
  if (pathname === "/dashboard/all-files") return <AllFiles />;
  if (pathname === "/dashboard/shared") return <SharedPage />;
  if (pathname === "/dashboard/files") return <FilesPage />;
  if (pathname === "/dashboard/templates") return <TemplatesPage />;
  if (pathname === "/dashboard/design-systems") return <DesignSystemsPage />;
  if (pathname === "/dashboard/projects/shared") return <SharedPage />;

  if (pathname === "/dashboard/projects" || pathname === "/dashboard/projects/owned") {
    return (
      <ProjectGallery
        projects={projects}
        loading={loading}
        onOpen={(id) => void onOpen(id)}
        title={pathname === "/dashboard/projects" ? "All projects" : "Owned by me"}
      />
    );
  }

  return (
    <DashboardHome
      projects={projects}
      loading={loading}
      creating={creating}
      createError={createError}
      onCreate={onCreate}
      onOpen={onOpen}
    />
  );
}
