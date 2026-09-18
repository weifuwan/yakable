import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  deleteProject,
  remixProject,
  updateProject,
} from "@/features/project/api/projects";
import type { ProjectListItem } from "@/features/project/model/types";
import { editedLabel, projectDisplayName } from "@/features/project/model/project";

const PROJECTS_CHANGED_EVENT = "yakable:projects-changed";
const MENU_WIDTH = 188;

function projectPath(projectId: string) {
  return `/projects/${encodeURIComponent(projectId)}`;
}

function notifyProjectsChanged() {
  window.dispatchEvent(new Event(PROJECTS_CHANGED_EVENT));
}

function ActionIcon({ name }: { name: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<string, React.ReactNode> = {
    external: <path d="M14 5h5v5M19 5l-8 8M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />,
    analytics: <path d="M5 19V9M10 19V5M15 19v-7M20 19V8M3 19h19" />,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
    folder: <path d="M3.5 7.5h6l2 2h9v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-10Zm0 0v-1a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v1" />,
    workspace: <path d="M7 7h11l-2-2M18 7l-2 2M17 17H6l2 2M6 17l2-2" />,
    remix: <path d="M5 8a7 7 0 0 1 11-2l2 2M18 4v4h-4M19 16a7 7 0 0 1-11 2l-2-2M6 20v-4h4" />,
    rename: <path d="m4 16-.5 4.5L8 20l10.8-10.8a2 2 0 0 0-2.8-2.8L5.2 17.2M14.5 7.9l2.8 2.8" />,
    image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m5 17 4.5-4 3.2 3 2.3-2 4 3.5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5L9 6.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5 11a7 7 0 0 0 0 2l-2.1 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.5 3.1h5l.5-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2.1-1.5a7 7 0 0 0 .1-1Z" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function Separator() {
  return <div className="-mx-1 my-1 h-px bg-black/[0.08]" role="separator" />;
}

function MenuItem({
  icon,
  children,
  disabled = false,
  destructive = false,
  onClick,
  iconClassName = "",
}: {
  icon: string;
  children: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  onClick?: () => void;
  iconClassName?: string;
}) {
  return (
    <button
      className={`group flex min-h-8 w-full select-none items-center gap-2 rounded-lg border-0 bg-transparent px-2 py-1 text-left text-sm transition-colors duration-100 ${
        destructive
          ? "text-red-600 hover:bg-red-50"
          : disabled
            ? "cursor-not-allowed text-black/35"
            : "cursor-pointer text-[#252525] hover:bg-black/[0.045] active:bg-black/[0.07]"
      }`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <span className={`grid h-4 w-4 shrink-0 place-items-center ${iconClassName || (destructive ? "text-red-600" : "text-black/45 group-hover:text-black/70")}`}>
        <ActionIcon name={icon} />
      </span>
      <span>{children}</span>
    </button>
  );
}

function DialogShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/20 p-4 backdrop-blur-[1px]" onMouseDown={onClose}>
      <div
        className="w-full max-w-[430px] rounded-2xl border border-black/[0.10] bg-white p-5 shadow-[0_20px_70px_rgba(15,23,42,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="m-0 text-base font-semibold text-[#202322]">{title}</h2>
          <button className="grid h-7 w-7 place-items-center rounded-full border-0 bg-transparent text-lg text-black/40 hover:bg-black/[0.05] hover:text-black/70" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function RenameDialog({ project, onClose }: { project: ProjectListItem; onClose: () => void }) {
  const [name, setName] = useState(projectDisplayName(project));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await updateProject(project.id, { name: name.trim() });
      notifyProjectsChanged();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to rename project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogShell title="Rename project" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="mb-1.5 block text-xs font-medium text-black/55">Project name</label>
        <input
          className="h-10 w-full rounded-xl border border-black/[0.12] bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          autoFocus
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {error ? <p className="mb-0 mt-2 text-xs text-red-600">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button className="h-9 rounded-full border border-black/[0.12] bg-white px-4 text-sm hover:bg-black/[0.03]" type="button" onClick={onClose}>Cancel</button>
          <button className="h-9 rounded-full border-0 bg-[#20201f] px-4 text-sm font-medium text-white disabled:opacity-40" type="submit" disabled={!name.trim() || saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </DialogShell>
  );
}

function DeleteDialog({
  project,
  onClose,
  onDeleted,
}: {
  project: ProjectListItem;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    setError("");
    try {
      await deleteProject(project.id);
      notifyProjectsChanged();
      onDeleted();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete project.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <DialogShell title="Delete project?" onClose={onClose}>
      <p className="m-0 text-sm leading-6 text-black/60">
        <strong className="font-medium text-black/80">{projectDisplayName(project)}</strong> and its generated source files will be permanently deleted.
      </p>
      {error ? <p className="mb-0 mt-2 text-xs text-red-600">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <button className="h-9 rounded-full border border-black/[0.12] bg-white px-4 text-sm hover:bg-black/[0.03]" type="button" onClick={onClose}>Cancel</button>
        <button className="h-9 rounded-full border-0 bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40" type="button" disabled={deleting} onClick={() => void remove()}>{deleting ? "Deleting…" : "Delete"}</button>
      </div>
    </DialogShell>
  );
}

function SettingsDialog({
  project,
  onClose,
  onDelete,
}: {
  project: ProjectListItem;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <DialogShell title="Project settings" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <div className="mb-1 text-xs font-medium text-black/45">Project name</div>
          <div className="text-sm font-medium text-black/80">{projectDisplayName(project)}</div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-black/45">Project ID</div>
          <code className="block overflow-hidden text-ellipsis rounded-lg bg-black/[0.04] px-2.5 py-2 text-[11px] text-black/65">{project.id}</code>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 text-xs font-medium text-black/45">Template</div>
            <div className="text-sm capitalize text-black/70">{project.template}</div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-black/45">Last edited</div>
            <div className="text-sm text-black/70">{editedLabel(project.updatedAt)}</div>
          </div>
        </div>
        <div className="border-t border-black/[0.08] pt-4">
          <div className="mb-2 text-xs font-medium text-red-600">Danger zone</div>
          <button className="h-9 rounded-full border border-red-200 bg-white px-4 text-sm font-medium text-red-600 hover:bg-red-50" type="button" onClick={onDelete}>Delete project</button>
        </div>
      </div>
    </DialogShell>
  );
}

export function ProjectActionsMenu({
  project,
  active = false,
  onNavigate,
}: {
  project: ProjectListItem;
  active?: boolean;
  onNavigate: (path: string) => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<"rename" | "settings" | "delete" | null>(null);

  function calculatePosition() {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const estimatedHeight = 390;
    const top = Math.min(Math.max(8, rect.bottom + 4), window.innerHeight - estimatedHeight - 8);
    const left = Math.min(Math.max(8, rect.right - 28), window.innerWidth - MENU_WIDTH - 8);
    setPosition({ top, left });
  }

  function closeMenu() {
    setVisible(false);
    window.setTimeout(() => setOpen(false), 120);
  }

  function showDialog(next: "rename" | "settings" | "delete") {
    closeMenu();
    setDialog(next);
  }

  async function toggleStar() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await updateProject(project.id, { starred: !project.starred });
      notifyProjectsChanged();
      closeMenu();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update project.");
    } finally {
      setBusy(false);
    }
  }

  async function remix() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const copy = await remixProject(project.id);
      notifyProjectsChanged();
      closeMenu();
      onNavigate(projectPath(copy.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remix project.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    calculatePosition();
    const frame = window.requestAnimationFrame(() => setVisible(true));

    function closeOnOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }
    function reposition() {
      calculatePosition();
    }

    window.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          className={`fixed z-[300] w-[188px] origin-top-left overflow-hidden rounded-xl border border-black/[0.10] bg-white p-1 text-[#252525] shadow-[0_12px_32px_rgba(15,23,42,0.16)] transition-[opacity,transform] duration-150 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] ${visible ? "translate-y-0 scale-100 opacity-100" : "-translate-y-0.5 scale-[0.97] opacity-0"}`}
          style={{ top: position.top, left: position.left }}
          role="menu"
          aria-label={`Actions for ${projectDisplayName(project)}`}
        >
          <MenuItem icon="external" onClick={() => window.open(projectPath(project.id), "_blank", "noopener,noreferrer")}>Open in new tab</MenuItem>
          <MenuItem icon="external" disabled>View published site</MenuItem>
          <MenuItem icon="analytics" disabled>Analytics</MenuItem>
          <Separator />
          <MenuItem icon="star" iconClassName={project.starred ? "text-amber-600" : ""} onClick={() => void toggleStar()}>{project.starred ? "Unstar" : "Star"}</MenuItem>
          <MenuItem icon="folder" disabled>Move to folder</MenuItem>
          <MenuItem icon="workspace" disabled>Move to workspace</MenuItem>
          <Separator />
          <MenuItem icon="remix" onClick={() => void remix()}>Remix</MenuItem>
          <MenuItem icon="rename" onClick={() => showDialog("rename")}>Rename</MenuItem>
          <MenuItem icon="image" disabled>Edit thumbnail</MenuItem>
          <MenuItem icon="settings" onClick={() => showDialog("settings")}>Settings</MenuItem>
          <Separator />
          <MenuItem icon="trash" destructive onClick={() => showDialog("delete")}>Delete</MenuItem>
          {error ? <div className="px-2 pb-1 pt-1 text-[10px] leading-4 text-red-600">{error}</div> : null}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={anchorRef}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-0 bg-transparent text-black/45 transition duration-100 hover:bg-black/[0.06] hover:text-black/75 ${active || open ? "opacity-100" : "opacity-0 group-hover/project:opacity-100"}`}
        type="button"
        aria-label={`More actions for ${projectDisplayName(project)}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (open) {
            closeMenu();
          } else {
            calculatePosition();
            setError("");
            setOpen(true);
          }
        }}
      >
        <span className="text-[8px] leading-none tracking-[1px]">•••</span>
      </button>
      {menu}
      {dialog === "rename" ? <RenameDialog project={project} onClose={() => setDialog(null)} /> : null}
      {dialog === "settings" ? (
        <SettingsDialog
          project={project}
          onClose={() => setDialog(null)}
          onDelete={() => setDialog("delete")}
        />
      ) : null}
      {dialog === "delete" ? (
        <DeleteDialog
          project={project}
          onClose={() => setDialog(null)}
          onDeleted={() => {
            if (active) onNavigate("/dashboard/projects/owned");
          }}
        />
      ) : null}
    </>
  );
}

export { PROJECTS_CHANGED_EVENT };
