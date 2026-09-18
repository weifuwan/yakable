import { useEffect, useState } from "react";

import type { ProjectListItem } from "../api";
import { projectDisplayName } from "../utils/project";
import { ProjectActionsMenu } from "./ProjectActionsMenu";
import { Icon, type IconName, controlClass } from "./ui";

type NavigateHandler = (path: string) => void;

function projectPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`;
}

export function Topbar({ onNavigate }: { onNavigate: NavigateHandler }) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between px-4 pt-1 text-[#1d2525]">
      <div className="flex min-w-0 items-center gap-3">
        <a
          className="flex items-center gap-2 no-underline"
          href="/dashboard"
          aria-label="Yakable home"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("/dashboard");
          }}
        >
          <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-bold text-white shadow-sm">
            Y
          </span>
          <strong className="text-[15px] font-semibold tracking-[-0.02em]">
            Yakable
          </strong>
        </a>
        <span className="text-sm text-black/35">/</span>
        <button
          className="hidden h-9 items-center gap-2 rounded-lg border-0 bg-transparent px-2 text-sm text-black/65 transition hover:bg-black/[0.04] hover:text-black md:flex"
          type="button"
        >
          <span className="grid h-5 w-5 place-items-center rounded bg-gradient-to-br from-indigo-100 to-sky-100 text-[9px] font-bold text-indigo-600">
            Y
          </span>
          <span>My Workspace</span>
          <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-medium">
            Free
          </span>
          <Icon name="chevronDown" size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        
        <a
          className={`${controlClass} hidden no-underline md:inline-flex`}
          href="https://github.com/weifuwan/yakable"
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="github" size={15} /> GitHub
        </a>
        <button
          className="grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-neutral-800 text-[9px] font-semibold text-white shadow-[0_0_0_1px_rgba(0,0,0,0.1)]"
          type="button"
          aria-label="Account"
        >
          W
        </button>
      </div>
    </header>
  );
}

function SidebarItem({
  icon,
  label,
  pathname,
  onNavigate,
  to,
  shortcut,
}: {
  icon: IconName;
  label: string;
  pathname: string;
  onNavigate: NavigateHandler;
  to?: string;
  shortcut?: string;
}) {
  const active = Boolean(to && pathname === to);
  const className = `relative flex w-full items-center gap-2 rounded-md border-0 px-2 py-1.5 text-left text-sm no-underline transition-colors duration-150 ease-out ${
    active
      ? "bg-black/[0.075] font-medium text-[#1e2828]"
      : "bg-transparent text-[#001617] hover:bg-black/[0.04]"
  }`;

  const content = (
    <>
      <span className="grid h-[18px] w-[18px] shrink-0 place-items-center text-[#4e5a5a]">
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut ? (
        <kbd className="rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[9px] font-medium text-black/45">
          {shortcut}
        </kbd>
      ) : null}
    </>
  );

  if (!to) {
    return (
      <button className={className} type="button">
        {content}
      </button>
    );
  }

  return (
    <a
      className={className}
      href={to}
      aria-current={active ? "page" : undefined}
      onClick={(event) => {
        event.preventDefault();
        onNavigate(to);
      }}
    >
      {content}
    </a>
  );
}

function OwnedProjectsNavigation({
  projects,
  pathname,
  activeProjectId,
  onNavigate,
}: {
  projects: ProjectListItem[];
  pathname: string;
  activeProjectId?: string;
  onNavigate: NavigateHandler;
}) {
  const ownedPageActive = pathname === "/dashboard/projects/owned";
  const [expanded, setExpanded] = useState(
    ownedPageActive || Boolean(activeProjectId),
  );

  useEffect(() => {
    if (ownedPageActive || activeProjectId) {
      setExpanded(true);
    }
  }, [ownedPageActive, activeProjectId]);

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={`flex items-center rounded-md transition-colors duration-150 ease-out ${
          ownedPageActive ? "bg-black/[0.055]" : "hover:bg-black/[0.04]"
        }`}
      >
        <a
          className={`flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-sm no-underline transition-colors duration-150 ${
            ownedPageActive
              ? "font-medium text-[#1e2828]"
              : activeProjectId
                ? "text-black/75"
                : "text-[#001617]"
          }`}
          href="/dashboard/projects/owned"
          aria-current={ownedPageActive ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            setExpanded(true);
            onNavigate("/dashboard/projects/owned");
          }}
        >
          <span className="grid h-[18px] w-[18px] shrink-0 place-items-center text-[#4e5a5a]">
            <Icon name="user" size={16} />
          </span>
          <span className="min-w-0 flex-1 truncate">Owned by me</span>
        </a>
        <button
          className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md border-0 bg-transparent text-black/40 transition-colors duration-150 hover:bg-black/[0.04] hover:text-black/65"
          type="button"
          aria-label={expanded ? "Collapse owned projects" : "Expand owned projects"}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          <span
            className={`transition-transform duration-200 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] ${
              expanded ? "rotate-0" : "-rotate-90"
            }`}
          >
            <Icon name="chevronDown" size={13} />
          </span>
        </button>
      </div>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] ${
          expanded
            ? "grid-rows-[1fr] opacity-100"
            : "pointer-events-none grid-rows-[0fr] opacity-0"
        }`}
        aria-hidden={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="ml-[17px] border-l border-black/[0.09] py-0.5 pl-2">
            {projects.length ? (
              projects.map((project) => {
                const active = project.id === activeProjectId;
                const to = projectPath(project.id);
                const label = projectDisplayName(project);
                return (
                  <div
                    key={project.id}
                    className={`group/project flex min-w-0 items-center rounded-md pr-1 transition-colors duration-150 ease-out ${
                      active
                        ? "bg-black/[0.075] font-medium text-[#202727]"
                        : "text-black/60 hover:bg-black/[0.04] hover:text-black/80"
                    }`}
                  >
                    <a
                      className="min-w-0 flex-1 truncate px-2 py-1.5 text-[13px] text-inherit no-underline"
                      href={to}
                      aria-current={active ? "page" : undefined}
                      title={label}
                      onClick={(event) => {
                        event.preventDefault();
                        onNavigate(to);
                      }}
                    >
                      {label}
                    </a>
                    <ProjectActionsMenu
                      project={project}
                      active={active}
                      onNavigate={onNavigate}
                    />
                  </div>
                );
              })
            ) : (
              <span className="block px-2 py-1.5 text-[12px] text-black/35">
                No projects yet
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({
  pathname,
  onNavigate,
  projects = [],
  activeProjectId,
}: {
  pathname: string;
  onNavigate: NavigateHandler;
  projects?: ProjectListItem[];
  activeProjectId?: string;
}) {
  return (
    <aside className="flex h-full w-[245px] shrink-0 flex-col overflow-y-auto overflow-x-hidden overscroll-contain bg-[#f5f6f6] px-4 pb-2 pt-4">
      <button
        className="mb-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-black/[0.12] bg-white px-4 text-sm font-medium shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:border-black/[0.20] hover:bg-black/[0.015]"
        type="button"
      >
        <Icon name="plus" size={16} />
        <span>Create</span>
        <Icon name="chevronDown" size={14} />
      </button>

      <nav className="flex flex-col gap-2" aria-label="Main navigation">
        <SidebarItem
          icon="search"
          label="Search"
          shortcut="Ctrl K"
          pathname={pathname}
          onNavigate={onNavigate}
        />
        <SidebarItem
          icon="home"
          label="Home"
          to="/dashboard"
          pathname={pathname}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="mb-1 mt-4 px-2 text-[12px] font-medium text-black/45">
        Projects
      </div>

      <nav className="flex flex-col gap-1" aria-label="Project navigation">
        <SidebarItem
          icon="grid"
          label="All projects"
          to="/dashboard/projects"
          pathname={pathname}
          onNavigate={onNavigate}
        />
        <OwnedProjectsNavigation
          projects={projects}
          pathname={pathname}
          activeProjectId={activeProjectId}
          onNavigate={onNavigate}
        />
        <SidebarItem
          icon="share"
          label="Shared with me"
          to="/dashboard/projects/shared"
          pathname={pathname}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="my-3 h-px w-full bg-black/[0.09]" />

      <div className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
        <span className="grid h-[15px] w-[15px] place-items-center rounded bg-gradient-to-br from-indigo-100 to-sky-100 text-[8px] font-bold text-indigo-600">
          Y
        </span>
        <strong className="truncate text-[13px] font-semibold">
          My Workspace
        </strong>
        <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-medium">
          Free
        </span>
        <span className="ml-auto text-black/40">
          <Icon name="chevronDown" size={14} />
        </span>
      </div>

      <nav className="flex flex-col gap-2" aria-label="Workspace navigation">
        <SidebarItem
          icon="file"
          label="Files"
          to="/dashboard/files"
          pathname={pathname}
          onNavigate={onNavigate}
        />
        <SidebarItem
          icon="users"
          label="Shared with workspace"
          to="/dashboard/shared"
          pathname={pathname}
          onNavigate={onNavigate}
        />
        <SidebarItem
          icon="template"
          label="Templates"
          to="/dashboard/templates"
          pathname={pathname}
          onNavigate={onNavigate}
        />
        <SidebarItem
          icon="palette"
          label="Design Systems"
          to="/dashboard/design-systems"
          pathname={pathname}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="min-h-6 flex-1" />

      <div className="mb-3 h-px w-full bg-black/[0.09]" />

      <nav className="flex flex-col gap-2" aria-label="Help navigation">
        <SidebarItem
          icon="book"
          label="Documentation"
          pathname={pathname}
          onNavigate={onNavigate}
        />
        <SidebarItem
          icon="support"
          label="Get support"
          pathname={pathname}
          onNavigate={onNavigate}
        />
      </nav>
    </aside>
  );
}
