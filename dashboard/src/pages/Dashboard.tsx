import { useState } from "react";

import type { BuildIntentDecision, ProjectListItem } from "../api";
import { Composer } from "../components/Composer";
import { Sidebar, Topbar } from "../components/Layout";
import { ProjectGallery } from "../components/ProjectGallery";
import { Icon, iconButtonClass } from "../components/ui";
import { DesignSystemsPage } from "./DesignSystems";
import { FilesPage } from "./Files";
import { SharedPage } from "./Shared";
import { TemplatesPage } from "./Templates";
import { AllFiles } from "./AllFiles";

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
  onCreate: (prompt: string) => Promise<BuildIntentDecision>;
  onOpen: (id: string) => Promise<void>;
  onNavigate: (path: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createMessage, setCreateMessage] = useState("");

  async function create(prompt: string) {
    setCreating(true);
    setCreateError("");
    setCreateMessage("");
    try {
      const decision = await onCreate(prompt);
      if (decision.route !== "CREATE") {
        setCreateMessage(decision.message);
      }
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

  function renderProjectGallery(title = "Recents") {
    return (
      <ProjectGallery
        projects={projects}
        loading={loading}
        onOpen={(id) => void onOpen(id)}
        title={title}
      />
    );
  }

  function renderPage() {
    if (pathname === "/dashboard/all-files") return <AllFiles />;
    if (pathname === "/dashboard/shared") return <SharedPage />;
    if (pathname === "/dashboard/files") return <FilesPage />;
    if (pathname === "/dashboard/templates") return <TemplatesPage />;
    if (pathname === "/dashboard/design-systems") return <DesignSystemsPage />;
    if (pathname === "/dashboard/projects") return renderProjectGallery("All projects");
    if (pathname === "/dashboard/projects/owned") return renderProjectGallery("Owned by me");
    if (pathname === "/dashboard/projects/shared") return <SharedPage />;

    return (
      <>
        <section className="relative flex min-h-[492px] shrink-0 items-center justify-center overflow-hidden px-5 py-16">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#ffffff_0%,#ffffff_14%,#fafbff_24%,#eef1ff_34%,#ffffff_48%,#ffffff_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent via-white/40 to-white" />
          </div>

          <div className="relative z-10 flex w-full max-w-[700px] flex-col items-center text-center">
            <h1 className="mb-3 text-[34px] font-semibold tracking-[-0.035em] text-[#182020] max-sm:text-[28px]">
              Let&apos;s build something.
            </h1>
            <Composer onCreate={create} busy={creating} />
            {createMessage ? (
              <div
                className="mt-3 w-full rounded-xl border border-black/[0.08] bg-white/90 px-4 py-3 text-left shadow-[0_4px_18px_rgba(15,23,42,0.04)]"
                role="status"
              >
                <p className="m-0 text-sm leading-6 text-black/65">
                  {createMessage}
                </p>
              </div>
            ) : null}
            {createError ? (
              <div
                className="mt-3 w-full rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-left"
                role="alert"
              >
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-red-700/70">
                  Request paused
                </div>
                <p className="m-0 text-sm leading-6 text-red-800/80">
                  {createError}
                </p>
                <p className="mb-0 mt-1 text-xs leading-5 text-red-700/60">
                  Your Yakable session is still available. You can submit the prompt again without restarting the app.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        {renderProjectGallery()}
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
          <Sidebar
            pathname={pathname}
            onNavigate={onNavigate}
            projects={projects}
          />
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
