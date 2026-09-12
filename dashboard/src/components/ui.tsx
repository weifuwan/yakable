import type { ReactNode } from "react";

export type IconName =
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

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
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

  const paths: Record<IconName, ReactNode> = {
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

export const iconButtonClass =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent text-[#5f6868] transition hover:bg-black/[0.05] hover:text-[#182020] disabled:cursor-not-allowed disabled:opacity-40";
export const controlClass =
  "inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-black/[0.10] bg-white px-3 text-xs font-medium text-[#273131] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-black/[0.18] hover:bg-black/[0.025]";
