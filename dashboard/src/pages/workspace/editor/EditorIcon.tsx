import type { ReactNode } from "react";

type EditorIconName =
  | "menu"
  | "history"
  | "sidebar"
  | "monitor"
  | "chevron"
  | "copy"
  | "more"
  | "thumbUp"
  | "thumbDown";

export const roundIconButtonClass =
  "grid h-7 w-7 shrink-0 place-items-center rounded-full border-0 bg-transparent text-black/55 transition hover:bg-black/[0.05] hover:text-black";

export function EditorIcon({
  name,
  size = 16,
}: {
  name: EditorIconName;
  size?: number;
}) {
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

  const paths: Record<EditorIconName, ReactNode> = {
    menu: <path d="M5 7h14M5 12h14M5 17h14" />,
    history: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        className="shrink-0 size-5 text-tertiary-pulse group-hover/nav-icon:text-primary-pulse transition-colors"
        aria-hidden="true"
        data-circular-artwork=""
        data-default-size=""
        data-button-icon=""
      >
        <path d="M12 2.25C17.3848 2.25 21.75 6.61522 21.75 12C21.75 17.3848 17.3848 21.75 12 21.75C11.5146 21.75 11.0365 21.7142 10.5693 21.6455C10.1599 21.585 9.8765 21.2044 9.93652 20.7949C9.9968 20.3851 10.3783 20.1018 10.7881 20.1621C11.1832 20.2202 11.5879 20.25 12 20.25C16.5563 20.25 20.25 16.5563 20.25 12C20.25 7.44365 16.5563 3.75 12 3.75C11.5879 3.75 11.1832 3.77977 10.7881 3.83789C10.3783 3.89817 9.9968 3.61488 9.93652 3.20508C9.8765 2.79558 10.1599 2.41498 10.5693 2.35449C11.0365 2.28577 11.5146 2.25 12 2.25Z" />
        <path d="M4.32324 16.7598C4.65575 16.5128 5.12604 16.5816 5.37305 16.9141C5.85694 17.5655 6.43454 18.1431 7.08594 18.627C7.41845 18.874 7.48724 19.3442 7.24023 19.6768C6.99319 20.0091 6.52384 20.078 6.19141 19.8311C5.42224 19.2597 4.74033 18.5778 4.16895 17.8086C3.922 17.4762 3.99092 17.0068 4.32324 16.7598Z" />
        <path d="M12 7.25C12.4142 7.25 12.75 7.58579 12.75 8V11.6895L15.5303 14.4697C15.8232 14.7626 15.8232 15.2374 15.5303 15.5303C15.2374 15.8232 14.7626 15.8232 14.4697 15.5303L11.4697 12.5303C11.3291 12.3896 11.25 12.1989 11.25 12V8C11.25 7.58579 11.5858 7.25 12 7.25Z" />
        <path d="M2.35449 10.5693C2.41498 10.1599 2.79558 9.8765 3.20508 9.93652C3.61488 9.9968 3.89817 10.3783 3.83789 10.7881C3.77977 11.1832 3.75 11.5879 3.75 12C3.75 12.4121 3.77977 12.8168 3.83789 13.2119C3.89817 13.6217 3.61488 14.0032 3.20508 14.0635C2.79558 14.1235 2.41498 13.8401 2.35449 13.4307C2.28577 12.9635 2.25 12.4854 2.25 12C2.25 11.5146 2.28577 11.0365 2.35449 10.5693Z" />
        <path d="M6.19141 4.16895C6.52384 3.922 6.99319 3.99092 7.24023 4.32324C7.48724 4.65575 7.41845 5.12604 7.08594 5.37305C6.43454 5.85694 5.85694 6.43454 5.37305 7.08594C5.12604 7.41845 4.65575 7.48724 4.32324 7.24023C3.99092 6.99319 3.922 6.52384 4.16895 6.19141C4.74033 5.42224 5.42224 4.74033 6.19141 4.16895Z" />
      </svg>
    ),
    sidebar: (
      <>
        <rect x="3.5" y="5" width="17" height="14" rx="2" />
        <path d="M9 5v14" />
      </>
    ),
    monitor: (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M9 21h6M12 17v4" />
      </>
    ),
    chevron: <path d="m8 10 4 4 4-4" />,
    copy: (
      <>
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M16 8V5H5v11h3" />
      </>
    ),
    more: (
      <>
        <circle cx="6" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="18" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    thumbUp: (
      <path d="M8 10v9H4v-9h4ZM8 17h7.2a2 2 0 0 0 1.9-1.4l1.6-5A2 2 0 0 0 16.8 8H13l.4-2.3A2.3 2.3 0 0 0 11.1 3L8 10" />
    ),
    thumbDown: (
      <path d="M8 14V5H4v9h4ZM8 7h7.2a2 2 0 0 1 1.9 1.4l1.6 5a2 2 0 0 1-1.9 2.6H13l.4 2.3a2.3 2.3 0 0 1-2.3 2.7L8 14" />
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}
