import { useEffect, useRef, useState } from "react";

export function PreviewInteractionToolbar() {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [theme, setTheme] = useState<"auto" | "light" | "dark">("auto");
  const [keyboardShortcuts, setKeyboardShortcuts] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!optionsOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!toolbarRef.current?.contains(event.target as Node)) setOptionsOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [optionsOpen]);

  const toolButtonClass = "relative flex size-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-[#1B1B1B] outline-none transition-colors duration-150 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3168e8]/55 [&_svg]:size-4";
  const menuItemClass = "flex min-h-8 w-full items-center gap-2 rounded-lg border-0 bg-transparent px-2 py-1 text-left text-sm text-[#1B1B1B] outline-none transition-colors duration-100 hover:bg-black/[0.055] focus-visible:bg-black/[0.055] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-black/50";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center">
      <div ref={toolbarRef} className="pointer-events-auto relative">
        <div
          data-allow-shadow
          className={`absolute bottom-[46px] right-0 z-30 w-[190px] origin-bottom-right rounded-xl border border-black/[0.10] bg-white p-1 text-[#1B1B1B] shadow-[0_10px_30px_rgba(15,23,42,0.14),0_2px_6px_rgba(15,23,42,0.08)] transition-[opacity,transform] duration-150 ease-out ${optionsOpen ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-1 scale-[0.97] opacity-0"}`}
          role="menu"
          aria-hidden={!optionsOpen}
        >
          <button className={`${menuItemClass} bg-black/[0.075]`} type="button" role="menuitem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 15h8" /></svg>
            <span className="flex-1">Dock</span>
            <svg className="!text-[#1B1B1B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m7 12 3 3 7-7" /></svg>
          </button>
          <button className={menuItemClass} type="button" role="menuitem" onClick={() => setOptionsOpen(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M8 16 16 8M10 8h6v6" /></svg>
            <span>Minimize</span>
          </button>
          <button className={menuItemClass} type="button" role="menuitem" onClick={() => setOptionsOpen(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 3l18 18" /><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" /><path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c5 0 8.8 4.4 9.7 5.6a.7.7 0 0 1 0 .8 15.2 15.2 0 0 1-3.1 3.2M6.7 6.7A15.8 15.8 0 0 0 2.3 9.6a.7.7 0 0 0 0 .8C3.2 11.6 7 16 12 16c1 0 1.9-.2 2.8-.5" /></svg>
            <span>Hide</span>
          </button>
          <div className="-mx-1 my-1 h-px bg-black/[0.08]" />
          <div className="px-2 pb-1 pt-0.5 text-[10px] font-semibold tracking-[0.06em] text-black/60">THEME</div>
          {(["auto", "light", "dark"] as const).map((value) => (
            <button key={value} className={menuItemClass} type="button" role="menuitemradio" aria-checked={theme === value} onClick={() => setTheme(value)}>
              {value === "auto" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="7" /><path d="M12 5a7 7 0 0 0 0 14Z" fill="currentColor" stroke="none" /></svg>
              ) : value === "light" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M19.3 15.3A7.5 7.5 0 0 1 8.7 4.7a7.5 7.5 0 1 0 10.6 10.6Z" /></svg>
              )}
              <span className="flex-1 capitalize">{value === "auto" ? "Auto" : value}</span>
              {theme === value ? <svg className="!text-[#1B1B1B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m7 12 3 3 7-7" /></svg> : null}
            </button>
          ))}
          <div className="-mx-1 my-1 h-px bg-black/[0.08]" />
          <div className="flex min-h-9 items-center gap-2 px-2 text-sm">
            <span className="min-w-0 flex-1">Keyboard shortcuts</span>
            <button className={`relative h-5 w-9 shrink-0 rounded-full border-0 p-0 transition-colors duration-150 ${keyboardShortcuts ? "bg-[#1B1B1B]" : "bg-black/[0.16]"}`} type="button" role="switch" aria-checked={keyboardShortcuts} onClick={() => setKeyboardShortcuts((value) => !value)}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-150 ${keyboardShortcuts ? "translate-x-[18px]" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>

        <div data-allow-shadow className="relative h-10 rounded-full bg-white/[0.48] text-[#1B1B1B] shadow-[0_4px_4px_-2px_rgba(0,0,0,0.04),0_2px_2px_-1px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.12),inset_0_0.5px_0_rgba(255,255,255,0.24),inset_0_-0.5px_0_rgba(255,255,255,0.16),inset_0_0_0_0.5px_rgba(255,255,255,0.24)] backdrop-blur-md backdrop-saturate-[1.4] backdrop-brightness-[1.08] before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_100%)] before:content-['']">
          <div role="toolbar" aria-label="Preview interactions" className="relative flex h-full cursor-grab select-none items-center p-1 ps-0 active:cursor-grabbing">
            <div className="flex shrink-0 items-center gap-1">
              <button className={toolButtonClass} type="button" aria-label="Select elements" aria-pressed="false"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.0273 13.2705C10.5195 11.874 11.874 10.5195 13.2705 11.0273L19.7939 13.3994C21.3041 13.9486 21.3377 16.0722 19.8457 16.6689L17.6768 17.5371C17.6132 17.5625 17.5625 17.6132 17.5371 17.6768L16.6689 19.8457C16.0722 21.3377 13.9486 21.3041 13.3994 19.7939L11.0273 13.2705ZM3.25 17V16C3.25 15.5858 3.58579 15.25 4 15.25C4.41421 15.25 4.75 15.5858 4.75 16V17C4.75 18.2426 5.75736 19.25 7 19.25H8C8.41421 19.25 8.75 19.5858 8.75 20C8.75 20.4142 8.41421 20.75 8 20.75H7C4.92893 20.75 3.25 19.0711 3.25 17ZM12.7578 12.4375C12.5583 12.365 12.365 12.5583 12.4375 12.7578L14.8096 19.2812C14.888 19.4969 15.191 19.5021 15.2764 19.2891L16.1445 17.1191C16.3224 16.6746 16.6746 16.3224 17.1191 16.1445L19.2891 15.2764C19.5021 15.191 19.4969 14.888 19.2812 14.8096L12.7578 12.4375ZM3.25 8V7C3.25 4.92893 4.92893 3.25 7 3.25H8C8.41421 3.25 8.75 3.58579 8.75 4C8.75 4.41421 8.41421 4.75 8 4.75H7C5.75736 4.75 4.75 5.75736 4.75 7V8C4.75 8.41421 4.41421 8.75 4 8.75C3.58579 8.75 3.25 8.41421 3.25 8ZM19.25 8V7C19.25 5.75736 18.2426 4.75 17 4.75H16C15.5858 4.75 15.25 4.41421 15.25 4C15.25 3.58579 15.5858 3.25 16 3.25H17C19.0711 3.25 20.75 4.92893 20.75 7V8C20.75 8.41421 20.4142 8.75 20 8.75C19.5858 8.75 19.25 8.41421 19.25 8Z" /></svg></button>
              <button className={toolButtonClass} type="button" aria-label="Edit text inline" aria-pressed="false"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 3.25C20.4142 3.25 20.75 3.58579 20.75 4V7C20.75 7.41421 20.4142 7.75 20 7.75C19.5858 7.75 19.25 7.41421 19.25 7V4.75H12.75V19.25H15C15.4142 19.25 15.75 19.5858 15.75 20C15.75 20.4142 15.4142 20.75 15 20.75H9C8.58579 20.75 8.25 20.4142 8.25 20C8.25 19.5858 8.58579 19.25 9 19.25H11.25V4.75H4.75V7C4.75 7.41421 4.41421 7.75 4 7.75C3.58579 7.75 3.25 7.41421 3.25 7V4C3.25 3.58579 3.58579 3.25 4 3.25H20Z" /></svg></button>
              <button className={toolButtonClass} type="button" aria-label="Draw annotation" aria-pressed="false"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.4697 5.46933C14.8672 4.07207 17.1328 4.07207 18.5303 5.46933C19.9277 6.86675 19.9276 9.1324 18.5303 10.5299L8.82324 20.2369C8.49509 20.5651 8.05001 20.7496 7.58594 20.7496H5C4.0335 20.7496 3.25 19.9661 3.25 18.9996V16.4137C3.25012 15.9497 3.43461 15.5044 3.7627 15.1764L13.4697 5.46933ZM17.4697 6.52988C16.6581 5.71841 15.3419 5.71841 14.5303 6.52988L13.0605 7.99961L16 10.9391L17.4697 9.46933C18.2813 8.65765 18.2814 7.34151 17.4697 6.52988ZM4.75 18.9996C4.75 19.1377 4.86193 19.2496 5 19.2496H7.58594C7.65219 19.2496 7.71585 19.2232 7.7627 19.1764L14.9395 11.9996L12 9.06015L4.82324 16.2369C4.77647 16.2837 4.75012 16.3475 4.75 16.4137V18.9996Z" /></svg></button>
              <button className={toolButtonClass} type="button" aria-label="Add a comment" aria-pressed="false"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.75195 7C3.75197 5.75737 4.75932 4.74999 6.00195 4.75H18.002C19.2446 4.75001 20.2519 5.7574 20.252 7V15C20.252 16.2426 19.2446 17.25 18.002 17.25H17.002C16.5878 17.25 16.252 17.5858 16.252 18V19.6758L12.3877 17.3574L12.2979 17.3105C12.2047 17.2706 12.104 17.25 12.002 17.25H6.00195C4.75931 17.25 3.75195 16.2426 3.75195 15V7ZM2.25195 15C2.25195 17.0711 3.93089 18.75 6.00195 18.75H11.7939L16.6162 21.6436C16.8478 21.7824 17.1361 21.7853 17.3711 21.6523C17.6062 21.5192 17.752 21.2702 17.752 21V18.75H18.002C20.073 18.75 21.752 17.0711 21.752 15V7C21.7519 4.92898 20.073 3.25001 18.002 3.25H6.00195C3.93089 3.24999 2.25197 4.92894 2.25195 7V15Z" /></svg></button>
            </div>
            <span aria-hidden="true" className="mx-1 h-6 w-px bg-black/10" />
            <button className={`${toolButtonClass} ${optionsOpen ? "bg-black/5" : ""}`} type="button" aria-label="Toolbar options" aria-haspopup="menu" aria-expanded={optionsOpen} onClick={() => setOptionsOpen((value) => !value)}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.75 12C6.75 12.9665 5.9665 13.75 5 13.75C4.0335 13.75 3.25 12.9665 3.25 12C3.25 11.0335 4.0335 10.25 5 10.25C5.9665 10.25 6.75 11.0335 6.75 12ZM13.75 12C13.75 12.9665 12.9665 13.75 12 13.75C11.0335 13.75 10.25 12.9665 10.25 12C10.25 11.0335 11.0335 10.25 12 10.25C12.9665 10.25 13.75 11.0335 13.75 12ZM20.75 12C20.75 12.9665 19.9665 13.75 19 13.75C18.0335 13.75 17.25 12.9665 17.25 12C17.25 11.0335 18.0335 10.25 19 10.25C19.9665 10.25 20.75 11.0335 20.75 12Z" /></svg></button>
            <button className={`${toolButtonClass} -ml-1`} type="button" aria-label="Minimize toolbar"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.46967 6.46973C9.76256 6.17684 10.2373 6.17684 10.5302 6.46973L15.5302 11.4697C15.8231 11.7626 15.8231 12.2374 15.5302 12.5303L10.5302 17.5303C10.2373 17.8232 9.76256 17.8232 9.46967 17.5303C9.17678 17.2374 9.17678 16.7626 9.46967 16.4697L13.9394 12L9.46967 7.53028C9.17678 7.23738 9.17678 6.76262 9.46967 6.46973Z" /></svg></button>
          </div>
        </div>
      </div>
    </div>
  );
}
