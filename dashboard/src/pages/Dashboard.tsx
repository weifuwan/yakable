import { useState } from "react";

import type { ProjectListItem } from "../api";
import { Composer } from "../components/Composer";
import { Sidebar, Topbar } from "../components/Layout";
import { ProjectGallery } from "../components/ProjectGallery";
import { Icon, iconButtonClass } from "../components/ui";
import { DesignSystemsPage } from "./DesignSystems";
import { FilesPage } from "./Files";
import { SharedPage } from "./Shared";
import { TemplatesPage } from "./Templates";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  async function create(prompt: string) {
    setCreating(true);
    try {
      await onCreate(prompt);
    } finally {
      setCreating(false);
    }
  }

  function renderPage() {
    if (pathname === "/dashboard/shared") return <SharedPage />;
    if (pathname === "/dashboard/files") return <FilesPage />;
    if (pathname === "/dashboard/templates") return <TemplatesPage />;
    if (pathname === "/dashboard/design-systems") return <DesignSystemsPage />;

    return (
      <>
        <section className="yakable-dashboard-hero relative flex min-h-[492px] shrink-0 items-center justify-center overflow-hidden px-5 py-16">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#ffffff_0%,#ffffff_14%,#fafbff_24%,#eef1ff_34%,#ffffff_48%,#ffffff_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent via-white/40 to-white" />
          </div>

          <div className="relative z-10 flex w-full max-w-[700px] flex-col items-center text-center">
            <h1 className="mb-3 text-[34px] font-semibold tracking-[-0.035em] text-[#182020] max-sm:text-[28px]">
              Let&apos;s build something.
            </h1>
            <Composer onCreate={create} busy={creating} />
          </div>
        </section>

        <ProjectGallery
          projects={projects}
          loading={loading}
          onOpen={(id) => void onOpen(id)}
        />
      </>
    );
  }

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-[#f5f6f6] font-sans text-[#1e2828] antialiased">
      <Topbar onNavigate={onNavigate} />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          className={`shrink-0 overflow-hidden transition-[width] duration-150 ease-out ${sidebarCollapsed ? "w-0" : "w-[245px]"}`}
        >
          <Sidebar pathname={pathname} onNavigate={onNavigate} />
        </div>

        <div className="m-2 ml-0 flex min-w-0 flex-1 flex-col" style={{ marginLeft: 8 }}>
          <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-2xl border border-black/[0.09] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
            <button
              className={`${iconButtonClass} absolute left-2 top-1.5 z-20 hidden md:inline-flex`}
              style={{ cursor: "pointer" }}
              type="button"
              onClick={() => setSidebarCollapsed((value) => !value)}
              aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            >
              <Icon name="panel" size={16} />
            </button>

            {renderPage()}
          </main>
        </div>
      </div>
    </div>
  );
}
