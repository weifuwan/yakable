import { useState, type KeyboardEvent, type ReactNode } from "react";

type ViewKey = "preview" | "files" | "code" | "more";

type ViewTab = {
  key: ViewKey;
  label: string;
  activeWidth: number;
  collapsedWidth: number;
  activePaddingLeft: number;
  activePaddingRight: number;
  collapsedPaddingLeft: number;
  collapsedPaddingRight: number;
  icon: ReactNode;
};

const tabs: ViewTab[] = [
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
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
        <path d="M7.25 12C7.25 11.2275 7.2925 10.4739 7.37207 9.75H4.06348C3.86104 10.4655 3.75 11.2197 3.75 12C3.75 12.7803 3.86104 13.5345 4.06348 14.25H7.37207C7.2925 13.5261 7.25 12.7725 7.25 12ZM9.12891 15.75C9.31543 16.6194 9.56311 17.3996 9.85645 18.0596C10.1928 18.8165 10.5746 19.3822 10.96 19.749C11.3415 20.1122 11.6918 20.25 12 20.25C12.3082 20.25 12.6585 20.1122 13.04 19.749C13.4254 19.3822 13.8072 18.8165 14.1436 18.0596C14.4369 17.3996 14.6846 16.6194 14.8711 15.75H9.12891ZM4.65234 15.75C5.57076 17.5459 7.12701 18.9591 9.02344 19.6934C8.82867 19.3769 8.64854 19.0339 8.48633 18.6689C8.11097 17.8244 7.80993 16.8357 7.59863 15.75H4.65234ZM16.4014 15.75C16.1901 16.8357 15.889 17.8244 15.5137 18.6689C15.3514 19.0341 15.1705 19.3768 14.9756 19.6934C16.8724 18.9592 18.4291 17.5462 19.3477 15.75H16.4014ZM14.9756 4.30566C15.1706 4.62245 15.3513 4.96567 15.5137 5.33105C15.889 6.17561 16.1901 7.16429 16.4014 8.25H19.3477C18.429 6.4537 16.8726 5.03977 14.9756 4.30566ZM12 3.75C11.6918 3.75 11.3415 3.88785 10.96 4.25098C10.5746 4.61779 10.1928 5.18354 9.85645 5.94043C9.56311 6.60044 9.31543 7.38058 9.12891 8.25H14.8711C14.6846 7.38058 14.4369 6.60044 14.1436 5.94043C13.8072 5.18354 13.4254 4.61779 13.04 4.25098C12.6585 3.88785 12.3082 3.75 12 3.75ZM9.02344 4.30566C7.12686 5.03986 5.57082 6.45397 4.65234 8.25H7.59863C7.80993 7.16429 8.11097 6.17561 8.48633 5.33105C8.64867 4.96583 8.8285 4.62233 9.02344 4.30566ZM8.75 12C8.75 12.7821 8.79669 13.5362 8.88184 14.25H15.1182C15.2033 13.5362 15.25 12.7821 15.25 12C15.25 11.2179 15.2033 10.4638 15.1182 9.75H8.88184C8.79669 10.4638 8.75 11.2179 8.75 12ZM16.75 12C16.75 12.7725 16.7075 13.5261 16.6279 14.25H19.9365C20.139 13.5345 20.25 12.7803 20.25 12C20.25 11.2197 20.139 10.4655 19.9365 9.75H16.6279C16.7075 10.4739 16.75 11.2275 16.75 12ZM21.75 12C21.75 17.3848 17.3848 21.75 12 21.75C6.61522 21.75 2.25 17.3848 2.25 12C2.25 6.61522 6.61522 2.25 12 2.25C17.3848 2.25 21.75 6.61522 21.75 12Z" />
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
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
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
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
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
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
        <path d="M19.6025 15.364C19.9538 15.1445 20.4162 15.2511 20.6357 15.6023C20.8553 15.9535 20.7486 16.416 20.3975 16.6355L13.457 20.9734C12.5655 21.5304 11.4345 21.5304 10.543 20.9734L3.60254 16.6355C3.25136 16.416 3.14474 15.9535 3.36426 15.6023C3.58381 15.2511 4.04624 15.1445 4.39746 15.364L11.3379 19.701C11.7432 19.9542 12.2568 19.9542 12.6621 19.701L19.6025 15.364ZM19.6025 11.364C19.9538 11.1445 20.4162 11.2511 20.6357 11.6023C20.8553 11.9535 20.7486 12.416 20.3975 12.6355L13.457 16.9734C12.5655 17.5304 11.4345 17.5304 10.543 16.9734L3.60254 12.6355C3.25136 12.416 3.14474 11.9535 3.36426 11.6023C3.58381 11.2511 4.04624 11.1445 4.39746 11.364L11.3379 15.701C11.7432 15.9542 12.2568 15.9542 12.6621 15.701L19.6025 11.364ZM11.6963 2.31424C11.9217 2.21433 12.1846 2.23098 12.3975 2.36404L20.3975 7.36404C20.6167 7.5011 20.75 7.74123 20.75 7.99978C20.75 8.25834 20.6167 8.49846 20.3975 8.63553L12.3975 13.6355C12.1543 13.7875 11.8457 13.7875 11.6025 13.6355L3.60254 8.63553C3.38331 8.49846 3.25 8.25834 3.25 7.99978C3.25 7.74123 3.38331 7.5011 3.60254 7.36404L11.6025 2.36404L11.6963 2.31424ZM5.41406 7.99978L12 12.115L18.585 7.99978L12 3.88357L5.41406 7.99978Z" />
      </svg>
    ),
  },
];

export function ViewSwitcher() {
  const [activeView, setActiveView] = useState<ViewKey>("preview");
  const activeIndex = tabs.findIndex((tab) => tab.key === activeView);
  const tabWidths = tabs.map((tab) =>
    tab.key === activeView ? tab.activeWidth : tab.collapsedWidth,
  );
  const pillLeft = tabWidths
    .slice(0, activeIndex)
    .reduce((total, width) => total + width, 0);
  const pillWidth = Math.max(tabWidths[activeIndex] - 2, 0);
  const trackWidth = tabWidths.reduce((total, width) => total + width, 0);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let nextIndex = activeIndex;
    if (event.key === "ArrowRight") nextIndex = (activeIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (activeIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    setActiveView(tabs[nextIndex].key);
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <div className="flex items-center gap-1.5">
        <div className="relative inline-flex items-center gap-1.5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 z-[1] rounded-full border border-[#82a8ff] bg-[#eaf0ff]"
            style={{
              left: pillLeft,
              width: pillWidth,
              transition: "left 150ms ease-out, width 150ms ease-out",
            }}
          />
          <div
            role="tablist"
            tabIndex={-1}
            aria-label="Editor view"
            onKeyDown={handleKeyDown}
            className="relative inline-flex h-7 items-center overflow-hidden rounded-full border border-black/[0.08] bg-[#f3f3f2]"
            style={{
              width: trackWidth,
              transition: "width 340ms cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          >
            {tabs.map((tab, index) => {
              const active = tab.key === activeView;
              const width = active ? tab.activeWidth : tab.collapsedWidth;
              const paddingLeft = active ? tab.activePaddingLeft : tab.collapsedPaddingLeft;
              const paddingRight = active ? tab.activePaddingRight : tab.collapsedPaddingRight;
              return (
                <div key={tab.key} className="contents">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={tab.label}
                    tabIndex={active ? 0 : -1}
                    onClick={() => setActiveView(tab.key)}
                    className={`relative z-10 flex h-7 shrink-0 items-center overflow-hidden rounded-full whitespace-nowrap border-0 bg-transparent outline-none transition-[width,padding,color,transform] active:scale-[0.97] ${active ? "cursor-default text-[#0044D2]" : "cursor-pointer text-[#727272] hover:text-[#262626]"}`}
                    style={{
                      width,
                      paddingLeft,
                      paddingRight,
                      transition: "width 340ms cubic-bezier(0.32, 0.72, 0, 1), padding-left 340ms cubic-bezier(0.32, 0.72, 0, 1), padding-right 340ms cubic-bezier(0.32, 0.72, 0, 1), color 150ms ease-out, transform 120ms ease-out",
                    }}
                  >
                    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">{tab.icon}</span>
                    <span
                      className="inline-block shrink-0 select-none overflow-hidden text-ellipsis whitespace-nowrap text-sm font-[450]"
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
                  {index < tabs.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-black/[0.10]"
                      style={{
                        left: tabWidths.slice(0, index + 1).reduce((total, currentWidth) => total + currentWidth, 0),
                        opacity: activeIndex === index || activeIndex === index + 1 ? 0 : 1,
                        transition: "left 340ms cubic-bezier(0.32, 0.72, 0, 1), opacity 80ms ease-out",
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
