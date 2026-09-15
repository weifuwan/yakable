import { useState, type ReactNode } from "react";

import type { ProjectListItem } from "../../../api";
import { Sidebar, Topbar } from "../../../components/Layout";
import { Icon, iconButtonClass } from "../../../components/ui";

export function DashboardLayout({
  pathname,
  projects,
  onNavigate,
  children,
}: {
  pathname: string;
  projects: ProjectListItem[];
  onNavigate: (path: string) => void;
  children: ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
