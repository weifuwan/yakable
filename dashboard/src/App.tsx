import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  createProject,
  editProject,
  listProjects,
  startProjectRuntime,
  type ProjectListItem,
} from "./api";

type IconName =
  | "home"
  | "search"
  | "grid"
  | "star"
  | "user"
  | "clock"
  | "plus"
  | "mic"
  | "send"
  | "sparkle"
  | "folder"
  | "back"
  | "refresh"
  | "external"
  | "share"
  | "file"
  | "users"
  | "template"
  | "palette"
  | "chevronDown"
  | "panel"
  | "sliders"
  | "list"
  | "image"
  | "github"
  | "figma"
  | "book"
  | "support"
  | "command";

type ActiveProject = {
  id: string;
  title: string;
  previewUrl: string;
  summary?: string;
  model?: string;
};

type ChatMessage = {
  role: "user" | "assistant" | "error";
  content: string;
};

type ViewMode = "grid" | "list";
type ProjectFilter = "all" | "day" | "week";
type ProjectSort = "updated" | "name";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<IconName, React.ReactNode> = {
    home: (
      <>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          style={{ strokeWidth: 1.5, width: 15, height: 15, color: "#001617" }}
        >
          <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path>
          <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        </svg>
      </>
    ),
    search: (
      <>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          style={{ strokeWidth: 1.5, width: 15, height: 15, color: "#001617" }}
        >
          <path d="m21 21-4.34-4.34"></path>
          <circle cx="11" cy="11" r="8"></circle>
        </svg>
      </>
    ),
    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1.5" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" />
        <rect x="4" y="14" width="6" height="6" rx="1.5" />
        <rect x="14" y="14" width="6" height="6" rx="1.5" />
      </>
    ),
    star: (
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.3 20c.8-4 3.1-6 6.7-6s5.9 2 6.7 6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3.2 2" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    mic: (
      <>
        <rect x="9" y="4" width="6" height="10" rx="3" />
        <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3" />
      </>
    ),
    send: (
      <>
        <svg
          width="15"
          height="15"
          viewBox="0 0 15 15"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: 15, height: 15, color: "#ffffff" }}
        >
          <path
            d="M7.14645 2.14645C7.34171 1.95118 7.65829 1.95118 7.85355 2.14645L11.8536 6.14645C12.0488 6.34171 12.0488 6.65829 11.8536 6.85355C11.6583 7.04882 11.3417 7.04882 11.1464 6.85355L8 3.70711L8 12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5L7 3.70711L3.85355 6.85355C3.65829 7.04882 3.34171 7.04882 3.14645 6.85355C2.95118 6.65829 2.95118 6.34171 3.14645 6.14645L7.14645 2.14645Z"
            fill="currentColor"
            fill-rule="evenodd"
            clip-rule="evenodd"
          ></path>
        </svg>
      </>
    ),
    sparkle: (
      <>
        <path d="m12 3 1.1 3.1L16 7.2l-2.9 1.1L12 11.5l-1.1-3.2L8 7.2l2.9-1.1L12 3Z" />
        <path d="m18 13 .8 2.1L21 16l-2.2.9L18 19l-.8-2.1L15 16l2.2-.9L18 13Z" />
      </>
    ),
    folder: <path d="M3.5 7.5h6l1.6 2h9.4v9.5h-17z" />,
    back: (
      <>
        <path d="m14.5 6-6 6 6 6" />
        <path d="M9 12h10" />
      </>
    ),
    refresh: (
      <>
        <path d="M19 8a7 7 0 1 0 .4 7" />
        <path d="M19 4v4h-4" />
      </>
    ),
    external: (
      <>
        <path d="M14 5h5v5" />
        <path d="m13 11 6-6" />
        <path d="M19 13v6H5V5h6" />
      </>
    ),
    share: (
      <>
        <circle cx="18" cy="5" r="2.2" />
        <circle cx="6" cy="12" r="2.2" />
        <circle cx="18" cy="19" r="2.2" />
        <path d="m8 11 8-5M8 13l8 5" />
      </>
    ),
    file: (
      <>
        <path d="M6 3.5h8l4 4V20H6z" />
        <path d="M14 3.5V8h4" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.6-3.4 2.4-5.2 5.5-5.2s4.9 1.8 5.5 5.2" />
        <path d="M15.5 5.5a2.7 2.7 0 0 1 0 5.2M16.2 14c2.4.3 3.7 1.9 4.2 4.4" />
      </>
    ),
    template: (
      <>
        <rect x="3.5" y="4" width="17" height="6" rx="1.5" />
        <rect x="3.5" y="14" width="8" height="6" rx="1.5" />
        <rect x="15.5" y="14" width="5" height="6" rx="1.5" />
      </>
    ),
    palette: (
      <>
        <circle cx="7" cy="7" r="2.2" />
        <circle cx="17" cy="7" r="2.2" />
        <circle cx="7" cy="17" r="2.2" />
        <circle cx="17" cy="17" r="2.2" />
      </>
    ),
    chevronDown: <path d="m7 9 5 5 5-5" />,
    panel: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 7h10M18 7h2M4 17h3M11 17h9" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="9" cy="17" r="2" />
      </>
    ),
    list: (
      <>
        <path d="M8 6h12M8 12h12M8 18h12" />
        <circle cx="4" cy="6" r=".7" fill="currentColor" stroke="none" />
        <circle cx="4" cy="12" r=".7" fill="currentColor" stroke="none" />
        <circle cx="4" cy="18" r=".7" fill="currentColor" stroke="none" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="m5 18 5-5 3 3 2-2 4 4" />
      </>
    ),
    github: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M9 18c-2 .5-2-1-3-1.5M15 18v-2.2c0-.8-.3-1.4-.8-1.8 2.6-.3 4.8-1.3 4.8-5a3.8 3.8 0 0 0-1-2.6c.1-.7.1-1.7-.4-2.6 0 0-.8-.2-2.7 1a9.5 9.5 0 0 0-5.8 0c-1.9-1.2-2.7-1-2.7-1-.5.9-.5 1.9-.4 2.6A3.8 3.8 0 0 0 6 9c0 3.7 2.2 4.7 4.8 5-.4.3-.7.8-.8 1.4V18" />
      </>
    ),
    figma: (
      <>
        <rect x="8" y="3" width="4" height="6" rx="2" />
        <rect x="12" y="3" width="4" height="6" rx="2" />
        <rect x="8" y="9" width="4" height="6" rx="2" />
        <circle cx="14" cy="12" r="2" />
        <rect x="8" y="15" width="4" height="6" rx="2" />
      </>
    ),
    book: (
      <>
        <path d="M4 4h6.5A3.5 3.5 0 0 1 14 7.5V20a3.5 3.5 0 0 0-3.5-3.5H4z" />
        <path d="M20 4h-6.5A3.5 3.5 0 0 0 10 7.5V20a3.5 3.5 0 0 1 3.5-3.5H20z" />
      </>
    ),
    support: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.7 9a2.4 2.4 0 0 1 4.6.9c0 1.8-2.3 2.2-2.3 3.8M12 17h.01" />
      </>
    ),
    command: <path d="M15.5 4.5 8.5 19.5" />,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

type DesignSystemId =
  | "base"
  | "wireframe"
  | "shadcn"
  | "chakra"
  | "mantine"
  | "mui";

type DesignSystemOption = {
  id: DesignSystemId;
  label: string;
};

const designSystemOptions: DesignSystemOption[] = [
  { id: "base", label: "Base" },
  { id: "wireframe", label: "Wireframe" },
  { id: "shadcn", label: "Shadcn" },
  { id: "chakra", label: "Chakra" },
  { id: "mantine", label: "Mantine" },
  { id: "mui", label: "MUI" },
];

function DesignSystemMark({
  type,
  size = 14,
}: {
  type: DesignSystemId;
  size?: number;
}) {
  if (type === "base") {
    return (
      <span
        className="relative shrink-0 overflow-hidden rounded-[3px] bg-[#e7f8ef]"
        style={{ width: size, height: size }}
      >
        <span className="absolute bottom-[2px] left-[2px] h-[5px] w-[6px] rotate-[-12deg] rounded-[1px] bg-emerald-300" />
        <span className="absolute bottom-[2px] right-[1px] h-[7px] w-[7px] rotate-[20deg] rounded-[1px] bg-sky-200" />
      </span>
    );
  }

  if (type === "wireframe") {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-[3px] border border-black/30 bg-white"
        style={{ width: size, height: size }}
      >
        <span className="grid h-[8px] w-[9px] grid-cols-2 gap-px">
          <i className="border-r border-black/25" />
          <i />
          <i className="col-span-2 border-t border-black/25" />
        </span>
      </span>
    );
  }

  if (type === "shadcn") {
    return (
      <span
        className="relative shrink-0 rounded-full bg-black"
        style={{ width: size, height: size }}
      >
        <span className="absolute left-[4px] top-[7px] h-px w-[7px] -rotate-45 bg-white" />
        <span className="absolute left-[6px] top-[8px] h-px w-[5px] -rotate-45 bg-white" />
      </span>
    );
  }

  if (type === "chakra") {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full bg-[#4cc5c9] text-[9px] font-bold text-white"
        style={{ width: size, height: size }}
      >
        ↗
      </span>
    );
  }

  if (type === "mantine") {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full bg-[#329af0] text-[9px] font-bold text-white"
        style={{ width: size, height: size }}
      >
        ✦
      </span>
    );
  }

  return (
    <span
      className="grid shrink-0 place-items-center rounded-[3px] bg-[#e8f4ff] text-[9px] font-extrabold text-[#1976d2]"
      style={{ width: size, height: size }}
    >
      M
    </span>
  );
}

function DesignSystemPicker({ disabled }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DesignSystemId>("base");
  const rootRef = useRef<HTMLDivElement>(null);

  const activeSystem =
    designSystemOptions.find((item) => item.id === selected) ??
    designSystemOptions[0];

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
  type="button"
  aria-label="Select design system"
  aria-haspopup="menu"
  aria-expanded={open}
  disabled={disabled}
  onClick={() => setOpen((value) => !value)}
  className="
    inline-flex h-6 cursor-pointer appearance-none items-center
    overflow-hidden rounded-full
    border border-solid border-[#e6f5fb]
    bg-white p-0
    text-[11px] font-medium text-[#263030]
    disabled:cursor-not-allowed disabled:opacity-50
  "
>
  <span
    className="
      hidden h-full items-center
      bg-[#e6f5fb]
      px-2.5
      tracking-[0.01em]
      text-[#036b94]
      md:inline-flex
    "
  >
    Design System
  </span>

  <span
    className="
      inline-flex h-full items-center gap-1
      border-0 border-l border-solid border-[#e6f5fb]
      bg-white
      px-2
      text-[#263030]
      transition-colors duration-100
      hover:bg-black/[0.025]
      max-md:pl-4
    "
  >
    <DesignSystemMark type={selected} size={14} />

    <span className="max-w-[160px] truncate">
      {activeSystem.label}
    </span>

    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-150 ${
        open ? "rotate-180" : ""
      }`}
      aria-hidden="true"
    >
      <path
        d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z"
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  </span>
</button>

      {open ? (
        <div
          className="
            absolute left-0 top-[calc(100%+6px)] z-[100]
            w-[182px]
            overflow-hidden
            rounded-[14px]
            border border-black/[0.14]
            bg-white
            p-[6px]
            text-[#263030]
            shadow-[0_12px_30px_rgba(15,23,42,0.16)]
          "
          role="menu"
          aria-label="Design systems"
        >
          <button
            className="
              flex h-7 w-full items-center gap-2
              rounded-[7px]
              border-0 bg-transparent
              px-2
              text-left text-[12px] font-medium
              text-[#263030]
              transition
              hover:bg-black/[0.045]
            "
            type="button"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <Icon name="plus" size={15} />
            <span>Create a Design System</span>
          </button>

          <div className="mx-1 my-[5px] h-px bg-black/[0.12]" />

          <div className="px-2 pb-1 pt-[2px] text-[11px] font-medium text-black/45">
            Default Design Systems
          </div>

          <div className="flex flex-col">
            {designSystemOptions.map((system) => {
              const checked = selected === system.id;

              return (
                <button
                  key={system.id}
                  className={`
                    flex h-7 w-full items-center gap-2
                    rounded-[7px]
                    border-0
                    px-2
                    text-left text-[12px]
                    transition
                    ${
                      checked
                        ? "bg-black/[0.025] text-[#172020]"
                        : "bg-transparent text-[#344040] hover:bg-black/[0.045]"
                    }
                  `}
                  type="button"
                  role="menuitemradio"
                  aria-checked={checked}
                  onClick={() => {
                    setSelected(system.id);
                    setOpen(false);
                  }}
                >
                  <DesignSystemMark type={system.id} size={14} />

                  <span className="min-w-0 flex-1 truncate">
                    {system.label}
                  </span>

                  {checked ? (
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M3.5 8.2 6.4 11l6.1-6.2"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function projectTitle(id: string): string {
  const base = id.replace(/-\d{4}-\d{2}-\d{2}T.*$/, "");
  return (base || id)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function editedLabel(updatedAt: string): string {
  const delta = Date.now() - new Date(updatedAt).getTime();
  const minutes = Math.max(0, Math.floor(delta / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const iconButtonClass =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent text-[#5f6868] transition hover:bg-black/[0.05] hover:text-[#182020] disabled:cursor-not-allowed disabled:opacity-40";
const controlClass =
  "inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-black/[0.10] bg-white px-3 text-xs font-medium text-[#273131] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-black/[0.18] hover:bg-black/[0.025]";

function Topbar() {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between px-4 pt-1 text-[#1d2525]">
      <div className="flex min-w-0 items-center gap-3">
        <a
          className="flex items-center gap-2 no-underline"
          href="/"
          aria-label="Yakable home"
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
        <span className="hidden items-center gap-1.5 rounded-lg bg-black/[0.04] px-3 py-1.5 text-xs font-medium text-black/65 md:flex">
          <i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Stage 3 ready
        </span>
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
  active,
  shortcut,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  shortcut?: string;
}) {
  return (
    <button
      className={`relative flex w-full items-center gap-2 rounded-md border-0 px-2 py-1.5 text-left text-sm transition ${
        active
          ? "bg-black/[0.075] font-medium text-[#1e2828]"
          : "bg-transparent text-[#001617] hover:bg-black/[0.05]"
      }`}
      type="button"
    >
      <span className="grid h-[18px] w-[18px] shrink-0 place-items-center text-[#4e5a5a]">
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut ? (
        <kbd className="rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[9px] font-medium text-black/45">
          {shortcut}
        </kbd>
      ) : null}
    </button>
  );
}

function Sidebar() {
  return (
    <aside className="flex h-full w-[245px] shrink-0 flex-col overflow-y-auto overflow-x-hidden bg-[#f5f6f6] px-4 pb-2 pt-4">
      <button
        className="mb-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-black/[0.12] bg-white px-4 text-sm font-medium shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:border-black/[0.20] hover:bg-black/[0.015]"
        type="button"
      >
        <Icon name="plus" size={16} />
        <span>Create</span>
        <Icon name="chevronDown" size={14} />
      </button>

      <nav className="flex flex-col gap-2" aria-label="Main navigation">
        <SidebarItem icon="search" label="Search" shortcut="Ctrl K" />
        <SidebarItem icon="home" label="Home" active />
        <SidebarItem icon="share" label="Shared with me" />
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
        <SidebarItem icon="file" label="Files" />
        <SidebarItem icon="users" label="Shared with workspace" />
        <SidebarItem icon="template" label="Templates" />
        <SidebarItem icon="palette" label="Design Systems" />
      </nav>

      <div className="min-h-6 flex-1" />

      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-black/[0.08] bg-white/70 p-2 shadow-[0_1px_3px_rgba(0,0,0,0.025)]">
        <div className="flex min-w-0 flex-col">
          <strong className="text-xs font-semibold">Generation flow</strong>
          <small className="truncate text-[10px] text-black/45">
            Prompt → Code → Run
          </small>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700">
          <i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Ready
        </span>
      </div>

      <div className="mb-3 h-px w-full bg-black/[0.09]" />

      <nav className="flex flex-col gap-2" aria-label="Help navigation">
        <SidebarItem icon="book" label="Documentation" />
        <SidebarItem icon="support" label="Get support" />
      </nav>
    </aside>
  );
}

function Composer({
  onCreate,
  busy,
}: {
  onCreate: (prompt: string) => Promise<void>;
  busy: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");

  const quickActions: Array<{ label: string; icon: IconName; prompt: string }> =
    [
      {
        label: "Recreate a screenshot",
        icon: "image",
        prompt:
          "Recreate a polished web page from a screenshot with a clean responsive layout.",
      },
      {
        label: "Import from GitHub",
        icon: "github",
        prompt:
          "Create a polished frontend for an existing GitHub project and keep the implementation simple.",
      },
      {
        label: "Import from Figma",
        icon: "figma",
        prompt:
          "Turn a Figma-style product design into a responsive React interface.",
      },
      {
        label: "Create a landing page",
        icon: "template",
        prompt:
          "Build a clean SaaS landing page with a hero, feature section, and pricing cards.",
      },
    ];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const request = prompt.trim();
    if (!request || busy) return;
    setError("");

    try {
      await onCreate(request);
      setPrompt("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Project generation failed.",
      );
    }
  }

  return (
    <div className="relative w-full">
      <form
        className="relative z-10 flex min-h-[104px] w-full flex-col rounded-2xl border border-black/[0.11] bg-white px-3 pb-2 pt-2 shadow-[0_2px_8px_rgba(15,23,42,0.07)] transition focus-within:border-black/[0.18] focus-within:shadow-[0_6px_24px_rgba(15,23,42,0.10)]"
        onSubmit={submit}
      >
        <textarea
          className="min-h-12 w-full resize-y border-0 bg-transparent px-1 py-2 text-[15px] leading-6 text-[#1e2525] outline-none placeholder:text-black/35 disabled:cursor-wait disabled:opacity-60"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ask Yakable to build anything..."
          aria-label="Describe what you want to build"
          rows={2}
          disabled={busy}
        />
        <div className="mt-1 flex min-h-8 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <button
              className={iconButtonClass}
              type="button"
              aria-label="Add attachment"
              disabled={busy}
            >
              <Icon name="plus" size={18} />
            </button>
            <button
              className={iconButtonClass}
              type="button"
              aria-label="Commands"
              disabled={busy}
            >
              <Icon name="command" size={18} />
            </button>
            <DesignSystemPicker disabled={busy} />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              className="inline-flex h-7 items-center gap-1 rounded-lg border-0 bg-transparent px-2 text-xs text-black/60 transition hover:bg-black/[0.04] hover:text-black disabled:opacity-40"
              type="button"
              disabled={busy}
            >
              Auto <Icon name="chevronDown" size={13} />
            </button>
            <button
              className={iconButtonClass}
              type="button"
              aria-label="Voice input"
              disabled={busy}
            >
              <Icon name="mic" size={16} />
            </button>
            <button
              className="grid h-9 w-9 place-items-center rounded-full border-0 bg-[#001617] text-white shadow-[0_1px_2px_rgba(0,0,0,0.16)]
               transition hover:bg-[#1c2424] disabled:cursor-default disabled:opacity-30"
              type="submit"
              disabled={!prompt.trim() || busy}
              aria-label="Send"
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  opacity: 1,
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 15 15"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-4 [&amp;&gt;path]:stroke-inherit"
                  style={{ height: 16, width: 16 }}
                >
                  <path
                    d="M7.14645 2.14645C7.34171 1.95118 7.65829 1.95118 7.85355 2.14645L11.8536 6.14645C12.0488 6.34171 12.0488 6.65829 11.8536 6.85355C11.6583 7.04882 11.3417 7.04882 11.1464 6.85355L8 3.70711L8 12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5L7 3.70711L3.85355 6.85355C3.65829 7.04882 3.34171 7.04882 3.14645 6.85355C2.95118 6.65829 2.95118 6.34171 3.14645 6.14645L7.14645 2.14645Z"
                    fill="currentColor"
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                  ></path>
                </svg>
              </span>
            </button>
          </div>
        </div>
      </form>

      <div
        className="mt-3 hidden flex-wrap justify-center gap-2 px-2 sm:flex"
        aria-label="Prompt shortcuts"
      >
        {quickActions.map((action) => (
          <button
            key={action.label}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-black/[0.10] bg-white px-3 text-xs font-normal text-[#344040] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-black/[0.18] hover:bg-black/[0.02] disabled:opacity-40"
            type="button"
            onClick={() => setPrompt(action.prompt)}
            disabled={busy}
          >
            <Icon name={action.icon} size={14} />
            {action.label}
          </button>
        ))}
      </div>

      {busy ? (
        <div className="absolute left-1/2 top-[calc(100%+12px)] z-20 flex max-w-[92%] -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white/90 px-3 py-2 text-[11px] text-black/60 shadow-lg backdrop-blur-xl">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/15 border-t-black/70" />
          DeepSeek is generating code and starting the runtime…
        </div>
      ) : null}

      {error ? (
        <div className="absolute left-1/2 top-[calc(100%+12px)] z-20 max-w-[92%] -translate-x-1/2 rounded-full bg-rose-50 px-3 py-2 text-[11px] text-rose-700 shadow-lg">
          {error}
        </div>
      ) : null}
    </div>
  );
}

const previewVariantClasses = [
  "bg-gradient-to-br from-slate-50 via-sky-50 to-sky-200",
  "bg-gradient-to-br from-violet-50 via-indigo-50 to-violet-200",
  "bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-200",
];

function ProjectPreview({ index }: { index: number }) {
  const variantClass =
    previewVariantClasses[index % previewVariantClasses.length] ??
    previewVariantClasses[0];

  return (
    <div
      className={`absolute inset-0 grid place-items-center p-3 transition duration-200 group-hover/thumb:scale-[1.015] ${variantClass}`}
    >
      <div className="h-[82%] w-[88%] overflow-hidden rounded-lg bg-white/95 shadow-[0_5px_18px_rgba(0,0,0,0.12)]">
        <div className="flex h-[11%] items-center gap-1 border-b border-black/[0.06] pl-2">
          <span className="h-[3px] w-[3px] rounded-full bg-black/15" />
          <span className="h-[3px] w-[3px] rounded-full bg-black/15" />
          <span className="h-[3px] w-[3px] rounded-full bg-black/15" />
        </div>
        <div className="h-[89%] px-[9%] py-[7%]">
          <div className="mb-[11%] flex items-center gap-[7%]">
            <b className="grid h-2.5 w-2.5 place-items-center rounded-[3px] bg-neutral-900 text-[4px] text-white">
              Y
            </b>
            <span className="h-[3px] w-[15%] rounded-full bg-black/15" />
            <span className="h-[3px] w-[15%] rounded-full bg-black/15" />
            <span className="h-[3px] w-[15%] rounded-full bg-black/15" />
          </div>
          <div className="mx-auto mb-1.5 h-2 w-[72%] rounded-full bg-neutral-800" />
          <div className="mx-auto mb-1.5 h-1.5 w-[52%] rounded-full bg-black/25" />
          <div className="mx-auto mb-3 mt-2.5 h-2 w-[23%] rounded-full bg-neutral-700" />
          <div className="grid grid-cols-3 gap-1.5">
            <i className="h-7 rounded bg-black/[0.055]" />
            <i className="h-7 rounded bg-black/[0.055]" />
            <i className="h-7 rounded bg-black/[0.055]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  index,
  onOpen,
  viewMode,
}: {
  project: ProjectListItem;
  index: number;
  onOpen: (id: string) => void;
  viewMode: ViewMode;
}) {
  return (
    <article
      className={`group/card min-w-0 overflow-hidden rounded-xl border border-black/[0.09] bg-white transition hover:border-black/[0.18] ${viewMode === "list" ? "flex min-h-[92px]" : ""}`}
    >
      <button
        className={`group/thumb relative overflow-hidden border-0 bg-slate-50 p-0 text-left ${
          viewMode === "list" ? "w-40 shrink-0" : "aspect-[3/2] w-full"
        }`}
        type="button"
        onClick={() => onOpen(project.id)}
        aria-label={`Open ${projectTitle(project.id)}`}
      >
        <ProjectPreview index={index} />
        <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg border border-black/[0.10] bg-white/90 text-black/55 opacity-0 shadow-sm backdrop-blur transition group-hover/card:opacity-100">
          <Icon name="star" size={15} />
        </span>
      </button>

      <button
        className={`flex min-w-0 items-center gap-2 border-0 bg-white text-left ${
          viewMode === "list"
            ? "flex-1 px-4 py-3"
            : "h-[47px] w-full border-t border-black/[0.08] px-3"
        }`}
        type="button"
        onClick={() => onOpen(project.id)}
      >
        <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[7px] border-2 border-white bg-sky-600 text-white shadow-sm">
          <Icon name="grid" size={12} />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-sm font-medium text-[#222b2b]">
            {projectTitle(project.id)}
          </strong>
          <small className="block truncate text-[10px] text-black/45">
            Edited {editedLabel(project.updatedAt)}
          </small>
        </span>
        <span className="text-sm text-black/35 opacity-0 transition group-hover/card:opacity-100">
          •••
        </span>
      </button>
    </article>
  );
}

function ProjectGallery({
  projects,
  loading,
  onOpen,
}: {
  projects: ProjectListItem[];
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [sort, setSort] = useState<ProjectSort>("updated");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const visibleProjects = useMemo(() => {
    const now = Date.now();
    const maxAge =
      filter === "day"
        ? 86_400_000
        : filter === "week"
          ? 604_800_000
          : Number.POSITIVE_INFINITY;

    const filtered = projects.filter((project) => {
      const matchesSearch = projectTitle(project.id)
        .toLowerCase()
        .includes(query.trim().toLowerCase());
      const age = now - new Date(project.updatedAt).getTime();
      return matchesSearch && age <= maxAge;
    });

    return [...filtered].sort((a, b) =>
      sort === "name"
        ? projectTitle(a.id).localeCompare(projectTitle(b.id))
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [projects, query, filter, sort]);

  return (
    <section className="mx-auto w-full max-w-[1400px] bg-white px-6 pb-10 pt-2 lg:px-9">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="m-0 text-base font-medium text-[#202929]">Recents</h2>

        <div className="flex items-center gap-3">
          <button
            className={`${iconButtonClass} border border-black/[0.10] bg-white shadow-sm ${searchOpen ? "bg-black/[0.05] text-black" : ""}`}
            type="button"
            aria-label="Search projects"
            onClick={() => setSearchOpen((value) => !value)}
          >
            <Icon name="search" size={14} />
          </button>

          <div className="relative">
            <button
              className={`${controlClass} ${filter !== "all" ? "bg-black/[0.05]" : ""}`}
              type="button"
              onClick={() => setFilterOpen((value) => !value)}
            >
              <Icon name="sliders" size={14} />
              Filter
            </button>
            {filterOpen ? (
              <div className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-40 overflow-hidden rounded-xl border border-black/[0.10] bg-white p-1.5 shadow-xl">
                {(
                  [
                    ["all", "All projects"],
                    ["day", "Last 24 hours"],
                    ["week", "Last 7 days"],
                  ] as Array<[ProjectFilter, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`flex w-full rounded-lg border-0 px-3 py-2 text-left text-xs transition hover:bg-black/[0.04] ${filter === value ? "bg-black/[0.06] font-medium" : "bg-white"}`}
                    onClick={() => {
                      setFilter(value);
                      setFilterOpen(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <label className={`${controlClass} hidden pr-2 md:inline-flex`}>
            <select
              className="appearance-none border-0 bg-transparent pr-1 text-xs outline-none"
              value={sort}
              onChange={(event) => setSort(event.target.value as ProjectSort)}
              aria-label="Sort projects"
            >
              <option value="updated">Last Updated</option>
              <option value="name">Name</option>
            </select>
            <Icon name="chevronDown" size={13} />
          </label>

          <div
            className="inline-flex h-7 items-center gap-0.5 rounded-lg bg-black/[0.075] p-1 shadow-inner"
            role="group"
            aria-label="Project view"
          >
            <button
              className={`grid h-5 w-9 place-items-center rounded-md border-0 transition ${viewMode === "grid" ? "bg-white text-black shadow-sm" : "bg-transparent text-black/45"}`}
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
            >
              <Icon name="grid" size={14} />
            </button>
            <button
              className={`grid h-5 w-9 place-items-center rounded-md border-0 transition ${viewMode === "list" ? "bg-white text-black shadow-sm" : "bg-transparent text-black/45"}`}
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="List view"
            >
              <Icon name="list" size={14} />
            </button>
          </div>
        </div>
      </div>

      {searchOpen ? (
        <div className="mb-4 flex h-10 items-center gap-2 rounded-xl border border-black/[0.09] bg-[#fafafa] px-3 text-black/45">
          <Icon name="search" size={16} />
          <input
            className="w-full border-0 bg-transparent text-sm text-black outline-none placeholder:text-black/35"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
          />
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-40 items-center justify-center text-sm text-black/45">
          Loading generated projects…
        </div>
      ) : null}

      {!loading && visibleProjects.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-1 text-center text-sm text-black/45">
          <strong className="text-sm font-medium text-black/70">
            No projects here yet.
          </strong>
          <span>
            Describe an idea above and Yakable will create the first one.
          </span>
        </div>
      ) : null}

      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "flex flex-col gap-3"
        }
      >
        {visibleProjects.map((project, index) => (
          <ProjectCard
            key={project.id}
            project={project}
            index={index}
            onOpen={onOpen}
            viewMode={viewMode}
          />
        ))}
      </div>
    </section>
  );
}

function Dashboard({
  projects,
  loading,
  onCreate,
  onOpen,
}: {
  projects: ProjectListItem[];
  loading: boolean;
  onCreate: (prompt: string) => Promise<void>;
  onOpen: (id: string) => Promise<void>;
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

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-[#f5f6f6] font-sans text-[#1e2828] antialiased">
      <Topbar />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          className={`shrink-0 overflow-hidden transition-[width] duration-150 ease-out ${sidebarCollapsed ? "w-0" : "w-[245px]"}`}
        >
          <Sidebar />
        </div>

        <div
          className="m-2 ml-0 flex min-w-0 flex-1 flex-col"
          style={{ marginLeft: 8 }}
        >
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

            <section className="relative flex min-h-[492px] shrink-0 items-center justify-center overflow-hidden px-5 py-16">
              <div
                className="pointer-events-none absolute inset-0"
                aria-hidden="true"
              >
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
          </main>
        </div>
      </div>
    </div>
  );
}

const messageRoleClasses: Record<ChatMessage["role"], string> = {
  user: "self-end rounded-br-md bg-[#202020] text-white",
  assistant: "self-start rounded-bl-md bg-[#f5f5f3] text-[#4d4d49]",
  error: "self-start bg-rose-50 text-rose-700",
};

function Workspace({
  project,
  onBack,
}: {
  project: ActiveProject;
  onBack: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState(project.previewUrl);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        project.summary ||
        "Project is running. Tell Yakable what you want to change.",
    },
  ]);

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    const request = prompt.trim();
    if (!request || busy) return;

    setPrompt("");
    setMessages((current) => [...current, { role: "user", content: request }]);
    setBusy(true);

    try {
      const result = await editProject(project.id, request);
      setPreviewUrl(result.previewUrl);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `${result.summary}\nChanged: ${result.changedFiles.join(", ")}`,
        },
      ]);
    } catch (caught) {
      setMessages((current) => [
        ...current,
        {
          role: "error",
          content: caught instanceof Error ? caught.message : "Edit failed.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function refreshPreview() {
    const url = new URL(previewUrl);
    url.searchParams.set("clientRefresh", String(Date.now()));
    setPreviewUrl(url.toString());
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f3f3f1] font-sans text-[#1e2828] antialiased">
      <header className="grid h-[52px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-black/[0.09] bg-[#fafaf8]/95 px-3 backdrop-blur-xl max-[820px]:grid-cols-[auto_1fr_auto]">
        <button
          className="inline-flex h-8 items-center gap-1.5 justify-self-start rounded-lg border-0 bg-transparent px-2.5 text-xs text-black/60 transition hover:bg-black/[0.05] hover:text-black"
          type="button"
          onClick={onBack}
        >
          <Icon name="back" size={17} />
          <span className="max-[820px]:hidden">Dashboard</span>
        </button>

        <div className="flex min-w-0 items-center gap-2 text-[13px] max-[820px]:justify-center">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-[9px] font-bold text-white">
            Y
          </span>
          <strong className="max-w-80 truncate font-semibold">
            {project.title}
          </strong>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
            <i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live
          </span>
        </div>

        <div className="flex items-center gap-1 justify-self-end">
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border-0 bg-transparent px-2.5 text-xs text-black/60 transition hover:bg-black/[0.05] hover:text-black"
            type="button"
            onClick={refreshPreview}
          >
            <Icon name="refresh" size={16} />
            <span className="max-[820px]:hidden">Refresh</span>
          </button>
          <a
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-black/60 no-underline transition hover:bg-black/[0.05] hover:text-black"
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="external" size={16} />
            <span className="max-[820px]:hidden">Open</span>
          </a>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(320px,390px)_minmax(0,1fr)] gap-2 p-2 max-[820px]:grid-cols-1 max-[820px]:grid-rows-[minmax(260px,42%)_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-black/[0.09] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.025)]">
          <div className="flex h-[46px] shrink-0 items-center justify-between border-b border-black/[0.07] px-4">
            <span className="text-[13px] font-semibold">Build</span>
            <small className="text-[10px] text-black/45">
              {project.model || "DeepSeek"}
            </small>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3.5 py-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[92%] whitespace-pre-wrap rounded-[14px] px-3 py-2.5 text-xs leading-5 ${messageRoleClasses[message.role]}`}
              >
                {message.content.split("\n").map((line, lineIndex) => (
                  <p className="m-0" key={`${line}-${lineIndex}`}>
                    {line}
                  </p>
                ))}
              </div>
            ))}

            {busy ? (
              <div className="flex max-w-[92%] items-center gap-2 self-start rounded-[14px] rounded-bl-md bg-[#f5f5f3] px-3 py-2.5 text-xs text-[#4d4d49]">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/15 border-t-black/70" />
                Updating the existing project…
              </div>
            ) : null}
          </div>

          <form
            className="m-2.5 shrink-0 rounded-2xl border border-black/[0.10] bg-[#fbfbfa] p-2.5 shadow-[0_5px_18px_rgba(0,0,0,0.04)]"
            onSubmit={submitEdit}
          >
            <textarea
              className="min-h-16 w-full resize-none border-0 bg-transparent text-xs leading-5 text-[#20201e] outline-none placeholder:text-black/35"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ask Yakable to change this project…"
              rows={3}
              disabled={busy}
            />
            <div className="flex items-center justify-between pt-1 text-[10px] text-black/45">
              <span>Prompt → Patch</span>
              <button
                className="grid h-[30px] w-[30px] place-items-center rounded-full border-0 bg-[#171717] text-white disabled:cursor-default disabled:opacity-25"
                type="submit"
                disabled={!prompt.trim() || busy}
              >
                <Icon name="send" size={17} />
              </button>
            </div>
          </form>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-black/[0.09] bg-[#ececea] shadow-[0_4px_16px_rgba(0,0,0,0.025)]">
          <div className="flex h-[38px] shrink-0 items-center gap-2 border-b border-black/[0.08] bg-[#f8f8f6] px-3.5 text-[10px] text-black/45">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="truncate">
              {previewUrl.replace(/^https?:\/\//, "").split("?")[0]}
            </span>
          </div>
          <iframe
            className="min-h-0 w-full flex-1 border-0 bg-white"
            key={previewUrl}
            title={`${project.title} preview`}
            src={previewUrl}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
        </section>
      </div>
    </div>
  );
}

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
