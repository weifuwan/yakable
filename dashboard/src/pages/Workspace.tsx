import { FormEvent, useEffect, useRef, useState } from "react";

import {
  editProject,
  type ProjectRoute,
  type ProjectTemplate,
} from "../api";
import { EditorActions } from "../components/EditorActions";
import { PreviewRoutePicker } from "../components/PreviewRoutePicker";
import { Icon } from "../components/ui";

export type ActiveProject = {
  id: string;
  title: string;
  previewUrl: string;
  template: ProjectTemplate;
  routes: ProjectRoute[];
  summary?: string;
  model?: string;
};

type ChatMessage = {
  role: "user" | "assistant" | "error";
  content: string;
};

type EditorIconName =
  | "menu"
  | "history"
  | "sidebar"
  | "globe"
  | "code"
  | "layers"
  | "monitor"
  | "share"
  | "bolt"
  | "publish"
  | "chevron"
  | "copy"
  | "more"
  | "thumbUp"
  | "thumbDown";

const suggestionPrompts = [
  "Polish this page",
  "Improve the mobile layout",
  "Refine the copy",
  "Add subtle interactions",
];

const DEFAULT_CHAT_WIDTH = 45.3;
const MIN_CHAT_WIDTH = 17;
const MAX_CHAT_WIDTH = 70;
const FALLBACK_ROUTES: ProjectRoute[] = [{ path: "/", title: "Home" }];

const roundIconButtonClass =
  "grid h-7 w-7 shrink-0 place-items-center rounded-full border-0 bg-transparent text-black/55 transition hover:bg-black/[0.05] hover:text-black";

function clampChatWidth(value: number) {
  return Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, value));
}

function buildPreviewUrl(runtimeUrl: string, routePath: string): string {
  const url = new URL(runtimeUrl, window.location.origin);
  url.pathname = routePath || "/";
  return url.toString();
}

function EditorIcon({
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

  const paths: Record<EditorIconName, React.ReactNode> = {
    menu: (
      <>
        <path d="M5 7h14M5 12h14M5 17h14" />
      </>
    ),
    history: (
      <>
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
          <path
            d="M12 2.25C17.3848 2.25 21.75 6.61522 21.75 12C21.75 17.3848 17.3848 21.75 12 21.75C11.5146 21.75 11.0365 21.7142 10.5693 21.6455C10.1599 21.585 9.8765 21.2044 9.93652 20.7949C9.9968 20.3851 10.3783 20.1018 10.7881 20.1621C11.1832 20.2202 11.5879 20.25 12 20.25C16.5563 20.25 20.25 16.5563 20.25 12C20.25 7.44365 16.5563 3.75 12 3.75C11.5879 3.75 11.1832 3.77977 10.7881 3.83789C10.3783 3.89817 9.9968 3.61488 9.93652 3.20508C9.8765 2.79558 10.1599 2.41498 10.5693 2.35449C11.0365 2.28577 11.5146 2.25 12 2.25Z"
            fill="currentColor"
          ></path>
          <path
            d="M4.32324 16.7598C4.65575 16.5128 5.12604 16.5816 5.37305 16.9141C5.85694 17.5655 6.43454 18.1431 7.08594 18.627C7.41845 18.874 7.48724 19.3442 7.24023 19.6768C6.99319 20.0091 6.52384 20.078 6.19141 19.8311C5.42224 19.2597 4.74033 18.5778 4.16895 17.8086C3.922 17.4762 3.99092 17.0068 4.32324 16.7598Z"
            fill="currentColor"
          ></path>
          <path
            d="M12 7.25C12.4142 7.25 12.75 7.58579 12.75 8V11.6895L15.5303 14.4697C15.8232 14.7626 15.8232 15.2374 15.5303 15.5303C15.2374 15.8232 14.7626 15.8232 14.4697 15.5303L11.4697 12.5303C11.3291 12.3896 11.25 12.1989 11.25 12V8C11.25 7.58579 11.5858 7.25 12 7.25Z"
            fill="currentColor"
          ></path>
          <path
            d="M2.35449 10.5693C2.41498 10.1599 2.79558 9.8765 3.20508 9.93652C3.61488 9.9968 3.89817 10.3783 3.83789 10.7881C3.77977 11.1832 3.75 11.5879 3.75 12C3.75 12.4121 3.77977 12.8168 3.83789 13.2119C3.89817 13.6217 3.61488 14.0032 3.20508 14.0635C2.79558 14.1235 2.41498 13.8401 2.35449 13.4307C2.28577 12.9635 2.25 12.4854 2.25 12C2.25 11.5146 2.28577 11.0365 2.35449 10.5693Z"
            fill="currentColor"
          ></path>
          <path
            d="M6.19141 4.16895C6.52384 3.922 6.99319 3.99092 7.24023 4.32324C7.48724 4.65575 7.41845 5.12604 7.08594 5.37305C6.43454 5.85694 5.85694 6.43454 5.37305 7.08594C5.12604 7.41845 4.65575 7.48724 4.32324 7.24023C3.99092 6.99319 3.922 6.52384 4.16895 6.19141C4.74033 5.42224 5.42224 4.74033 6.19141 4.16895Z"
            fill="currentColor"
          ></path>
        </svg>
      </>
    ),
    sidebar: (
      <>
        <rect x="3.5" y="5" width="17" height="14" rx="2" />
        <path d="M9 5v14" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.8 12h16.4M12 3.5c2 2.3 3 5.1 3 8.5s-1 6.2-3 8.5M12 3.5c-2 2.3-3 5.1-3 8.5s1 6.2 3 8.5" />
      </>
    ),
    code: (
      <>
        <path d="m9 7-5 5 5 5M15 7l5 5-5 5M13.5 4l-3 16" />
      </>
    ),
    layers: (
      <>
        <path d="m12 4 8 4-8 4-8-4 8-4Z" />
        <path d="m4 12 8 4 8-4M4 16l8 4 8-4" />
      </>
    ),
    monitor: (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M9 21h6M12 17v4" />
      </>
    ),
    share: (
      <>
        <circle cx="8" cy="12" r="2" />
        <circle cx="17" cy="7" r="2" />
        <circle cx="17" cy="17" r="2" />
        <path d="m9.8 11 5.4-3M9.8 13l5.4 3" />
      </>
    ),
    bolt: <path d="m13 2-7 11h6l-1 9 7-12h-6l1-8Z" />,
    publish: (
      <>
        <path d="M12 16V4" />
        <path d="m8 8 4-4 4 4" />
        <path d="M5 13v6h14v-6" />
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
      <>
        <path d="M8 10v9H4v-9h4ZM8 17h7.2a2 2 0 0 0 1.9-1.4l1.6-5A2 2 0 0 0 16.8 8H13l.4-2.3A2.3 2.3 0 0 0 11.1 3L8 10" />
      </>
    ),
    thumbDown: (
      <>
        <path d="M8 14V5H4v9h4ZM8 7h7.2a2 2 0 0 1 1.9 1.4l1.6 5a2 2 0 0 1-1.9 2.6H13l.4 2.3a2.3 2.3 0 0 1-2.3 2.7L8 14" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function ViewSwitcher() {
  type ViewKey = "preview" | "files" | "code" | "more";

  const [activeView, setActiveView] = useState<ViewKey>("preview");

  const tabs: Array<{
    key: ViewKey;
    label: string;
    activeWidth: number;
    collapsedWidth: number;
    activePaddingLeft: number;
    activePaddingRight: number;
    collapsedPaddingLeft: number;
    collapsedPaddingRight: number;
    icon: React.ReactNode;
  }> = [
    {
      key: "preview",
      label: "Preview",
      activeWidth: 89,
      collapsedWidth: 36,
      activePaddingLeft: 6,
      activePaddingRight: 2,
      collapsedPaddingLeft: 10,
      collapsedPaddingRight: 4,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <path d="M7.25 12C7.25 11.2275 7.2925 10.4739 7.37207 9.75H4.06348C3.86104 10.4655 3.75 11.2197 3.75 12C3.75 12.7803 3.86104 13.5345 4.06348 14.25H7.37207C7.2925 13.5261 7.25 12.7725 7.25 12ZM9.12891 15.75C9.31543 16.6194 9.56311 17.3996 9.85645 18.0596C10.1928 18.8165 10.5746 19.3822 10.96 19.749C11.3415 20.1122 11.6918 20.25 12 20.25C12.3082 20.25 12.6585 20.1122 13.04 19.749C13.4254 19.3822 13.8072 18.8165 14.1436 18.0596C14.4369 17.3996 14.6846 16.6194 14.8711 15.75H9.12891ZM4.65234 15.75C5.57076 17.5459 7.12701 18.9591 9.02344 19.6934C8.82867 19.3769 8.64854 19.0339 8.48633 18.6689C8.11097 17.8244 7.80993 16.8357 7.59863 15.75H4.65234ZM16.4014 15.75C16.1901 16.8357 15.889 17.8244 15.5137 18.6689C15.3514 19.0341 15.1705 19.3768 14.9756 19.6934C16.8724 18.9592 18.4291 17.5462 19.3477 15.75H16.4014ZM14.9756 4.30566C15.1706 4.62245 15.3513 4.96567 15.5137 5.33105C15.889 6.17561 16.1901 7.16429 16.4014 8.25H19.3477C18.429 6.4537 16.8726 5.03977 14.9756 4.30566ZM12 3.75C11.6918 3.75 11.3415 3.88785 10.96 4.25098C10.5746 4.61779 10.1928 5.18354 9.85645 5.94043C9.56311 6.60044 9.31543 7.38058 9.12891 8.25H14.8711C14.6846 7.38058 14.4369 6.60044 14.1436 5.94043C13.8072 5.18354 13.4254 4.61779 13.04 4.25098C12.6585 3.88785 12.3082 3.75 12 3.75ZM9.02344 4.30566C7.12686 5.03986 5.57082 6.45397 4.65234 8.25H7.59863C7.80993 7.16429 8.11097 6.17561 8.48633 5.33105C8.64867 4.96583 8.8285 4.62233 9.02344 4.30566ZM8.75 12C8.75 12.7821 8.79669 13.5362 8.88184 14.25H15.1182C15.2033 13.5362 15.25 12.7821 15.25 12C15.25 11.2179 15.2033 10.4638 15.1182 9.75H8.88184C8.79669 10.4638 8.75 11.2179 8.75 12ZM16.75 12C16.75 12.7725 16.7075 13.5261 16.6279 14.25H19.9365C20.139 13.5345 20.25 12.7803 20.25 12C20.25 11.2197 20.139 10.4655 19.9365 9.75H16.6279C16.7075 10.4739 16.75 11.2275 16.75 12ZM21.75 12C21.75 17.3848 17.3848 21.75 12 21.75C6.61522 21.75 2.25 17.3848 2.25 12C2.25 6.61522 6.61522 2.25 12 2.25C17.3848 2.25 21.75 6.61522 21.75Z" />
        </svg>
      ),
    },
    {
      key: "files",
      label: "Files",
      activeWidth: 68,
      collapsedWidth: 34,
      activePaddingLeft: 6,
      activePaddingRight: 2,
      collapsedPaddingLeft: 8,
      collapsedPaddingRight: 4,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <path d="M15 16.25C15.4142 16.25 15.75 16.5858 15.75 17C15.75 17.4142 15.4142 17.75 15 17.75H9C8.58579 17.75 8.25 17.4142 8.25 17C8.25 16.5858 8.58579 16.25 9 16.25H15ZM12 12.25C12.4142 12.25 12.75 12.5858 12.75 13C12.75 13.4142 12.4142 13.75 12 13.75H9C8.58579 13.75 8.25 13.4142 8.25 13C8.25 12.5858 8.58579 12.25 9 12.25H12ZM19.75 18C19.75 20.0711 18.0711 21.75 16 21.75H8C5.92893 21.75 4.25 20.0711 4.25 18V6C4.25 3.92893 5.92893 2.25 8 2.25H13C13.1989 2.25 13.3896 2.32907 13.5303 2.46973L19.5303 8.46973C19.6709 8.61038 19.75 8.80109 19.75 9V18ZM5.75 18C5.75 19.2426 6.75736 20.25 8 20.25H16C17.2426 20.25 18.25 19.2426 18.25 18V9.75H16C13.9289 9.75 12.25 8.07107 12.25 6V3.75H8C6.75736 3.75 5.75 4.75736 5.75 6V18ZM13.75 6C13.75 7.24264 14.7574 8.25 16 8.25H17.1895L13.75 4.81055V6Z" />
        </svg>
      ),
    },
    {
      key: "code",
      label: "Code",
      activeWidth: 70,
      collapsedWidth: 36,
      activePaddingLeft: 6,
      activePaddingRight: 2,
      collapsedPaddingLeft: 10,
      collapsedPaddingRight: 4,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <path d="M13.2724 3.8184C13.3728 3.41663 13.7798 3.17219 14.1816 3.2725C14.5834 3.37295 14.8278 3.77991 14.7275 4.18168L10.7275 20.1817C10.627 20.5835 10.2201 20.8279 9.8183 20.7276C9.41653 20.6271 9.17209 20.2202 9.2724 19.8184L13.2724 3.8184ZM6.46967 7.46977C6.76256 7.17688 7.23732 7.17688 7.53022 7.46977C7.82311 7.76266 7.82311 8.23742 7.53022 8.53032L4.06049 12L7.53022 15.4698C7.82311 15.7627 7.82311 16.2374 7.53022 16.5303C7.23732 16.8232 6.76256 16.8232 6.46967 16.5303L2.46967 12.5303C2.17678 12.2374 2.17678 11.7627 2.46967 11.4698L6.46967 7.46977ZM16.4697 7.46977C16.7626 7.17688 17.2373 7.17688 17.5302 7.46977L21.5302 11.4698C21.8231 11.7627 21.8231 12.2374 21.5302 12.5303L17.5302 16.5303C17.2373 16.8232 16.7626 16.8232 16.4697 16.5303C16.1768 16.2374 16.1768 15.7627 16.4697 15.4698L19.9394 12L16.4697 8.53032C16.1768 8.23742 16.1768 7.76266 16.4697 7.46977Z" />
        </svg>
      ),
    },
    {
      key: "more",
      label: "More",
      activeWidth: 72,
      collapsedWidth: 36,
      activePaddingLeft: 6,
      activePaddingRight: 2,
      collapsedPaddingLeft: 10,
      collapsedPaddingRight: 4,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <path d="M19.6025 15.364C19.9538 15.1445 20.4162 15.2511 20.6357 15.6023C20.8553 15.9535 20.7486 16.416 20.3975 16.6355L13.457 20.9734C12.5655 21.5304 11.4345 21.5304 10.543 20.9734L3.60254 16.6355C3.25136 16.416 3.14474 15.9535 3.36426 15.6023C3.58381 15.2511 4.04624 15.1445 4.39746 15.364L11.3379 19.701C11.7432 19.9542 12.2568 19.9542 12.6621 19.701L19.6025 15.364ZM19.6025 11.364C19.9538 11.1445 20.4162 11.2511 20.6357 11.6023C20.8553 11.9535 20.7486 12.416 20.3975 12.6355L13.457 16.9734C12.5655 17.5304 11.4345 17.5304 10.543 16.9734L3.60254 12.6355C3.25136 12.416 3.14474 11.9535 3.36426 11.6023C3.58381 11.2511 4.04624 11.1445 4.39746 11.364L11.3379 15.701C11.7432 15.9542 12.2568 15.9542 12.6621 15.701L19.6025 11.364ZM11.6963 2.31424C11.9217 2.21433 12.1846 2.23098 12.3975 2.36404L20.3975 7.36404C20.6167 7.5011 20.75 7.74123 20.75 7.99978C20.75 8.25834 20.6167 8.49846 20.3975 8.63553L12.3975 13.6355C12.1543 13.7875 11.8457 13.7875 11.6025 13.6355L3.60254 8.63553C3.38331 8.49846 3.25 8.25834 3.25 7.99978C3.25 7.74123 3.38331 7.5011 3.60254 7.36404L11.6025 2.36404L11.6963 2.31424ZM5.41406 7.99978L12 12.115L18.585 7.99978L12 3.88357L5.41406 7.99978Z" />
        </svg>
      ),
    },
  ];

  const activeIndex = tabs.findIndex((tab) => tab.key === activeView);

  const tabWidths = tabs.map((tab) =>
    tab.key === activeView ? tab.activeWidth : tab.collapsedWidth,
  );

  const pillLeft = tabWidths
    .slice(0, activeIndex)
    .reduce((total, width) => total + width, 0);

  const pillWidth = Math.max(tabWidths[activeIndex] - 2, 0);

  const trackWidth = tabWidths.reduce((total, width) => total + width, 0);

  function selectView(nextView: ViewKey) {
    setActiveView(nextView);

    // TODO:
    // 这里后面可以继续接真正的 Preview / Files / Code / More 页面切换。
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    let nextIndex = activeIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (activeIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (activeIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    setActiveView(tabs[nextIndex].key);
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <div className="flex items-center gap-1.5">
        <div className="relative inline-flex items-center gap-1.5">
          {/* 移动的蓝色选中 Pill */}
          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute inset-y-0 z-[1]
              rounded-full
              border border-[#82a8ff]
              bg-[#eaf0ff]
            "
            style={{
              left: pillLeft,
              width: pillWidth,
              transition:
                "left 150ms ease-out, width 150ms ease-out",
            }}
          />

          {/* Track */}
          <div
            role="tablist"
            tabIndex={-1}
            aria-label="Editor view"
            onKeyDown={handleKeyDown}
            className="
              relative inline-flex h-7 items-center
              overflow-hidden rounded-full
              border border-black/[0.08]
              bg-[#f3f3f2]
            "
            style={{
              width: trackWidth,
              transition:
                "width 340ms cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          >
            {tabs.map((tab, index) => {
              const active = tab.key === activeView;

              const width = active
                ? tab.activeWidth
                : tab.collapsedWidth;

              const paddingLeft = active
                ? tab.activePaddingLeft
                : tab.collapsedPaddingLeft;

              const paddingRight = active
                ? tab.activePaddingRight
                : tab.collapsedPaddingRight;

              return (
                <div
                  key={tab.key}
                  className="contents"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={tab.label}
                    tabIndex={active ? 0 : -1}
                    onClick={() => selectView(tab.key)}
                    className={`
                      relative z-10
                      flex h-7 shrink-0
                      items-center
                      overflow-hidden
                      rounded-full
                      whitespace-nowrap
                      border-0 bg-transparent
                      outline-none
                      transition-[width,padding,color,transform]
                      active:scale-[0.97]
                      ${
                        active
                          ? "cursor-default text-[#0044D2]"
                          : "cursor-pointer text-[#727272] hover:text-[#262626]"
                      }
                    `}
                    style={{
                      width,
                      paddingLeft,
                      paddingRight,
                      transition:
                        "width 340ms cubic-bezier(0.32, 0.72, 0, 1), " +
                        "padding-left 340ms cubic-bezier(0.32, 0.72, 0, 1), " +
                        "padding-right 340ms cubic-bezier(0.32, 0.72, 0, 1), " +
                        "color 150ms ease-out, " +
                        "transform 120ms ease-out",
                    }}
                  >
                    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                      {tab.icon}
                    </span>

                    {/* label 不只是 display none，
                        而是配合 button 宽度一起展开 / 收起 */}
                    <span
                      className="
                        inline-block
                        shrink-0 select-none
                        overflow-hidden
                        text-ellipsis
                        whitespace-nowrap
                        text-sm font-[450]
                      "
                      style={{
                        opacity: active ? 1 : 0,
                        marginLeft: active ? 4 : 0,
                        maxWidth: active ? 180 : 0,
                        transition: active
                          ? "opacity 220ms ease-out 80ms, margin-left 340ms cubic-bezier(0.32,0.72,0,1), max-width 340ms cubic-bezier(0.32,0.72,0,1)"
                          : "opacity 80ms ease-out, margin-left 340ms cubic-bezier(0.32,0.72,0,1), max-width 340ms cubic-bezier(0.32,0.72,0,1)",
                      }}
                    >
                      {tab.label}
                    </span>
                  </button>

                  {/* 分割线：
                      当前 active pill 两侧自动隐藏 */}
                  {index < tabs.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className="
                        pointer-events-none
                        absolute top-1/2
                        h-3 w-px
                        -translate-y-1/2
                        bg-black/[0.10]
                      "
                      style={{
                        left: tabWidths
                          .slice(0, index + 1)
                          .reduce(
                            (total, currentWidth) =>
                              total + currentWidth,
                            0,
                          ),
                        opacity:
                          activeIndex === index ||
                          activeIndex === index + 1
                            ? 0
                            : 1,
                        transition:
                          "left 340ms cubic-bezier(0.32, 0.72, 0, 1), opacity 80ms ease-out",
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}


function PreviewAddressBar({
  onRefresh,
  previewUrl,
  routes,
  currentRoute,
  onRouteChange,
}: {
  onRefresh: () => void;
  previewUrl: string;
  routes: ProjectRoute[];
  currentRoute: string;
  onRouteChange: (path: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-1 max-[1120px]:hidden">
      <button
        className={roundIconButtonClass}
        type="button"
        aria-label="Desktop view"
      >
        <EditorIcon name="monitor" size={14} />
      </button>
      <div className="flex h-7 min-w-[180px] max-w-[280px] flex-1 items-center rounded-full border border-black/[0.10] bg-white/85 px-1 shadow-[0_1px_2px_rgba(15,23,42,0.035)]">
        <button
          className={roundIconButtonClass}
          type="button"
          aria-label="Refresh preview"
          onClick={onRefresh}
        >
          <Icon name="refresh" size={13} />
        </button>
        <PreviewRoutePicker
          routes={routes}
          currentPath={currentRoute}
          onSelect={onRouteChange}
        />
      </div>
      <a
        className={`${roundIconButtonClass} no-underline`}
        href={previewUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="Open preview in new tab"
      >
        <Icon name="external" size={14} />
      </a>
    </div>
  );
}

function EditorHeader({
  project,
  onBack,
  onRefresh,
  previewUrl,
  routes,
  currentRoute,
  onRouteChange,
}: {
  project: ActiveProject;
  onBack: () => void;
  onRefresh: () => void;
  previewUrl: string;
  routes: ProjectRoute[];
  currentRoute: string;
  onRouteChange: (path: string) => void;
}) {
  return (
    <header className="grid h-12 shrink-0 [grid-template-columns:var(--editor-chat-width)_minmax(0,1fr)] items-center bg-[#f6f6f4] max-[900px]:grid-cols-[1fr_auto]">
      <div className="flex min-w-0 items-center justify-between gap-2 px-2">
        <div className="flex min-w-0 items-center gap-1">
          <button
            className={roundIconButtonClass}
            type="button"
            aria-label="Back to dashboard"
            onClick={onBack}
          >
            <EditorIcon name="menu" size={15} />
          </button>
          <button
            className="flex min-w-0 items-center gap-1.5 rounded-full border border-transparent bg-transparent px-2 py-1 text-sm font-medium transition hover:border-black/[0.08] hover:bg-black/[0.035]"
            type="button"
          >
            <span className="max-w-[260px] truncate">{project.title}</span>
            <EditorIcon name="chevron" size={13} />
          </button>
        </div>

        <div className="flex items-center gap-1 pr-1">
          <button
            className={roundIconButtonClass}
            type="button"
            aria-label="History"
          >
            <EditorIcon name="history" size={15} />
          </button>
          <button
            className={roundIconButtonClass}
            type="button"
            aria-label="Toggle chat panel"
          >
            <EditorIcon name="sidebar" size={15} />
          </button>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2 pr-2 max-[900px]:hidden">
        <ViewSwitcher />
        <PreviewAddressBar
          onRefresh={onRefresh}
          previewUrl={previewUrl}
          routes={routes}
          currentRoute={currentRoute}
          onRouteChange={onRouteChange}
        />
        <EditorActions />
      </div>
    </header>
  );
}

function MessageToolbar({ content }: { content: string }) {
  return (
    <div className="mt-1 flex items-center gap-0.5 text-black/45">
      <button
        className={roundIconButtonClass}
        type="button"
        aria-label="Revert this change"
      >
        <Icon name="back" size={13} />
      </button>
      <button
        className={roundIconButtonClass}
        type="button"
        aria-label="Helpful"
      >
        <EditorIcon name="thumbUp" size={13} />
      </button>
      <button
        className={roundIconButtonClass}
        type="button"
        aria-label="Not helpful"
      >
        <EditorIcon name="thumbDown" size={13} />
      </button>
      <button
        className={roundIconButtonClass}
        type="button"
        aria-label="Copy message"
        onClick={() => void navigator.clipboard?.writeText(content)}
      >
        <EditorIcon name="copy" size={13} />
      </button>
      <button
        className={roundIconButtonClass}
        type="button"
        aria-label="More options"
      >
        <EditorIcon name="more" size={13} />
      </button>
    </div>
  );
}

function ChatTimeline({
  messages,
  busy,
}: {
  messages: ChatMessage[];
  busy: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-3">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-3">
        {messages.map((message, index) => {
          if (message.role === "user") {
            return (
              <div key={`user-${index}`} className="flex justify-end py-1">
                <div className="max-w-[75%] rounded-[22px] rounded-br-md border border-black/[0.08] bg-white px-4 py-3 text-sm leading-6 text-[#30302d] shadow-[0_1px_2px_rgba(15,23,42,0.035)]">
                  {message.content}
                </div>
              </div>
            );
          }

          if (message.role === "error") {
            return (
              <div
                key={`error-${index}`}
                className="max-w-[86%] rounded-2xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700"
              >
                {message.content}
              </div>
            );
          }

          return (
            <div
              key={`assistant-${index}`}
              className="py-1 text-sm leading-6 text-[#3f3f3b]"
            >
              <button
                className="mb-1 border-0 bg-transparent p-0 text-[11px] text-black/42"
                type="button"
              >
                Thought for 1s
              </button>
              <div className="whitespace-pre-wrap">
                {message.content.split("\n").map((line, lineIndex) => (
                  <p className="m-0 min-h-6" key={`${line}-${lineIndex}`}>
                    {line}
                  </p>
                ))}
              </div>
              <MessageToolbar content={message.content} />
            </div>
          );
        })}

        {busy ? (
          <div className="flex items-center gap-2 py-2 text-sm text-black/50">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/15 border-t-black/65" />
            Yakable is updating the project…
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChatComposer({
  prompt,
  busy,
  onPromptChange,
  onSubmit,
}: {
  prompt: string;
  busy: boolean;
  onPromptChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <div className="shrink-0 px-3 pb-3">
      <div className="mx-auto w-full max-w-[760px]">
        <div className="scrollbar-hide mb-2 flex gap-1.5 overflow-x-auto px-1">
          {suggestionPrompts.map((suggestion) => (
            <button
              key={suggestion}
              className="h-7 shrink-0 rounded-full border border-black/[0.11] bg-white px-3 text-[11px] font-medium text-black/65 shadow-[0_1px_2px_rgba(15,23,42,0.035)] transition hover:bg-black/[0.025]"
              type="button"
              onClick={() => onPromptChange(suggestion)}
              disabled={busy}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form
          className="rounded-[22px] border border-black/[0.09] bg-white p-3 shadow-[0_6px_22px_rgba(15,23,42,0.08)]"
          onSubmit={onSubmit}
        >
          <textarea
            className="min-h-[54px] w-full resize-none border-0 bg-transparent px-1 pb-2 text-sm leading-6 text-[#2e2e2b] outline-none placeholder:text-black/38 disabled:opacity-60"
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder="Ask Yakable..."
            rows={2}
            disabled={busy}
          />
          <div className="flex items-center justify-between gap-2">
            <button
              className="grid h-7 w-7 place-items-center rounded-full border border-black/[0.11] bg-white text-black/55 transition hover:bg-black/[0.035]"
              type="button"
              aria-label="Add attachment"
              disabled={busy}
            >
              <Icon name="plus" size={15} />
            </button>

            <div className="flex items-center gap-1">
              <button
                className="inline-flex h-7 items-center gap-1 rounded-full border-0 bg-transparent px-2.5 text-xs font-medium text-black/65 transition hover:bg-black/[0.04]"
                type="button"
                disabled={busy}
              >
                Build <EditorIcon name="chevron" size={12} />
              </button>
              <button
                className={roundIconButtonClass}
                type="button"
                aria-label="Voice input"
                disabled={busy}
              >
                <Icon name="mic" size={14} />
              </button>
              <button
                className="grid h-7 w-7 place-items-center rounded-full border-0 bg-[#20201f] text-white transition hover:bg-black disabled:cursor-default disabled:opacity-25"
                type="submit"
                aria-label="Send"
                disabled={!prompt.trim() || busy}
              >
                <Icon name="send" size={15} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function PreviewInteractionToolbar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center">
      <div className="pointer-events-auto inline-flex h-10 items-center rounded-full border border-black/[0.13] bg-white/80 p-1 shadow-[0_6px_18px_rgba(15,23,42,0.10)] backdrop-blur-xl">
        <button
          className={roundIconButtonClass}
          type="button"
          aria-label="Select elements"
        >
          ↖
        </button>
        <button
          className={roundIconButtonClass}
          type="button"
          aria-label="Edit text"
        >
          <span className="text-sm font-medium">T</span>
        </button>
        <button
          className={roundIconButtonClass}
          type="button"
          aria-label="Draw annotation"
        >
          <span className="text-sm">✎</span>
        </button>
        <button
          className={roundIconButtonClass}
          type="button"
          aria-label="Comment"
        >
          <span className="text-sm">▢</span>
        </button>
        <button
          className={roundIconButtonClass}
          type="button"
          aria-label="More preview tools"
        >
          <EditorIcon name="more" size={14} />
        </button>
      </div>
    </div>
  );
}

export function Workspace({
  project,
  onBack,
}: {
  project: ActiveProject;
  onBack: () => void;
}) {
  const [runtimeUrl, setRuntimeUrl] = useState(project.previewUrl);
  const [routes, setRoutes] = useState<ProjectRoute[]>(
    project.routes.length ? project.routes : FALLBACK_ROUTES,
  );
  const [currentRoute, setCurrentRoute] = useState(
    project.routes[0]?.path ?? "/",
  );
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const panelsRef = useRef<HTMLDivElement>(null);
  const previewUrl = buildPreviewUrl(runtimeUrl, currentRoute);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        project.summary ||
        "Project is running. Tell Yakable what you want to change.",
    },
  ]);

  useEffect(() => {
    if (!isResizing) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function handlePointerMove(event: PointerEvent) {
      const panels = panelsRef.current;
      if (!panels) return;

      const rect = panels.getBoundingClientRect();
      if (!rect.width) return;

      const nextWidth = ((event.clientX - rect.left) / rect.width) * 100;
      setChatWidth(clampChatWidth(nextWidth));
    }

    function stopResizing() {
      setIsResizing(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizing]);

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    const request = prompt.trim();
    if (!request || busy) return;

    setPrompt("");
    setMessages((current) => [...current, { role: "user", content: request }]);
    setBusy(true);

    try {
      const result = await editProject(project.id, request);
      setRuntimeUrl(result.previewUrl);
      const nextRoutes = result.routes.length ? result.routes : routes;
      setRoutes(nextRoutes);
      setCurrentRoute((current) =>
        nextRoutes.some((route) => route.path === current)
          ? current
          : nextRoutes[0]?.path ?? "/",
      );
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result.changedFiles.length
            ? `${result.summary}\nChanged: ${result.changedFiles.join(", ")}`
            : result.summary,
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
    const url = new URL(runtimeUrl, window.location.origin);
    url.searchParams.set("clientRefresh", String(Date.now()));
    setRuntimeUrl(url.toString());
  }

  function handleResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setChatWidth((current) => clampChatWidth(current - 1));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setChatWidth((current) => clampChatWidth(current + 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setChatWidth(MIN_CHAT_WIDTH);
    } else if (event.key === "End") {
      event.preventDefault();
      setChatWidth(MAX_CHAT_WIDTH);
    }
  }

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-[#f6f6f4] font-sans text-[#252522] antialiased"
      style={{ "--editor-chat-width": `${chatWidth}%` } as React.CSSProperties}
    >
      <EditorHeader
        project={project}
        onBack={onBack}
        onRefresh={refreshPreview}
        previewUrl={previewUrl}
        routes={routes}
        currentRoute={currentRoute}
        onRouteChange={setCurrentRoute}
      />

      <div
        ref={panelsRef}
        className="relative grid min-h-0 flex-1 [grid-template-columns:var(--editor-chat-width)_minmax(0,1fr)] max-[900px]:grid-cols-1 max-[900px]:grid-rows-[45%_55%]"
      >
        <section className="flex min-h-0 flex-col overflow-hidden bg-[#f6f6f4]">
          <ChatTimeline messages={messages} busy={busy} />
          <ChatComposer
            prompt={prompt}
            busy={busy}
            onPromptChange={setPrompt}
            onSubmit={submitEdit}
          />
        </section>

        <div
          className="group/resize-handle absolute inset-y-0 z-30 flex w-3 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center outline-none max-[900px]:hidden"
          style={{ left: `${chatWidth}%` }}
          role="separator"
          aria-label="Resize chat and preview panels"
          aria-orientation="vertical"
          aria-valuemin={MIN_CHAT_WIDTH}
          aria-valuemax={MAX_CHAT_WIDTH}
          aria-valuenow={Math.round(chatWidth)}
          aria-valuetext={`${Math.round(chatWidth)}% chat, ${Math.round(100 - chatWidth)}% preview`}
          tabIndex={0}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            setIsResizing(true);
          }}
          onDoubleClick={() => setChatWidth(DEFAULT_CHAT_WIDTH)}
          onKeyDown={handleResizeKeyDown}
        >
          <span
            className={`pointer-events-none absolute inset-y-3 left-1/2 w-[7px] -translate-x-1/2 rounded-full transition-[opacity,filter] duration-200 ${
              isResizing
                ? "opacity-100"
                : "opacity-70 group-hover/resize-handle:opacity-100 group-focus-visible/resize-handle:opacity-100"
            }`}
            style={{
              backgroundImage: isResizing
                ? "linear-gradient(to right, rgba(75,115,255,0.16) 0 3px, rgba(47,111,237,0.92) 3px 4px, rgba(75,115,255,0.16) 4px 7px)"
                : "linear-gradient(to right, rgba(75,115,255,0.08) 0 3px, rgba(70,76,84,0.68) 3px 4px, rgba(75,115,255,0.08) 4px 7px)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 5%, rgba(0,0,0,0.5) 11%, black 18%, black 82%, rgba(0,0,0,0.5) 89%, rgba(0,0,0,0.15) 95%, transparent 100%)",
              maskImage:
                "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 5%, rgba(0,0,0,0.5) 11%, black 18%, black 82%, rgba(0,0,0,0.5) 89%, rgba(0,0,0,0.15) 95%, transparent 100%)",
              filter: isResizing
                ? "drop-shadow(0 0 5px rgba(75,115,255,0.32))"
                : "drop-shadow(0 0 3px rgba(75,115,255,0.14))",
            }}
          />
        </div>

        {isResizing ? (
          <div
            className="absolute inset-0 z-20 cursor-col-resize"
            aria-hidden="true"
          />
        ) : null}

        <section className="relative mb-2 mr-2 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_3px_14px_rgba(15,23,42,0.07)] max-[900px]:m-2">
          <iframe
            className="min-h-0 w-full flex-1 border-0 bg-white"
            key={previewUrl}
            title={`${project.title} preview`}
            src={previewUrl}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
          <PreviewInteractionToolbar />
        </section>
      </div>
    </div>
  );
}
