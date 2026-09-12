import type { ReactNode } from "react";

type ActionButtonVariant = "share" | "upgrade" | "publish";

type ActionButtonProps = {
  variant: ActionButtonVariant;
  icon: ReactNode;
  children: ReactNode;
};

const buttonVariantClasses: Record<ActionButtonVariant, string> = {
  share:
    "text-[#252525] bg-[linear-gradient(rgba(0,0,0,0.025),rgba(0,0,0,0.025)),#fff]",
  upgrade: "bg-[#8250df] text-white",
  publish: "bg-[#2f6fed] text-white",
};

const dropShadowClasses: Record<ActionButtonVariant, string> = {
  share:
    "shadow-[0_2px_2px_-1px_rgba(0,0,0,0.04),0_4px_4px_-2px_rgba(0,0,0,0.02)]",
  upgrade:
    "shadow-[0_2px_2px_-1px_rgba(74,33,134,0.16),0_4px_4px_-2px_rgba(74,33,134,0.12)]",
  publish:
    "shadow-[0_2px_2px_-1px_rgba(20,58,137,0.17),0_4px_4px_-2px_rgba(20,58,137,0.13)]",
};

const interactionClasses: Record<ActionButtonVariant, string> = {
  share:
    "bg-black opacity-0 transition-opacity duration-100 group-hover:opacity-[0.04] group-active:opacity-[0.06]",
  upgrade:
    "bg-[#41157a] opacity-0 transition-opacity duration-100 group-hover:opacity-[0.16] group-active:opacity-[0.26]",
  publish:
    "bg-[#163d9d] opacity-0 transition-opacity duration-100 group-hover:opacity-[0.17] group-active:opacity-[0.27]",
};

const spotlightClasses: Record<ActionButtonVariant, string> = {
  share:
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-1px_0_rgba(255,255,255,0.7)]",
  upgrade:
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(255,255,255,0.08)]",
  publish:
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.19),inset_0_-1px_0_rgba(255,255,255,0.08)]",
};

const domeClasses: Record<ActionButtonVariant, string> = {
  share:
    "bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(0,0,0,0.035))]",
  upgrade:
    "bg-[linear-gradient(to_bottom,rgba(255,255,255,0.08),rgba(0,0,0,0.08))]",
  publish:
    "bg-[linear-gradient(to_bottom,rgba(255,255,255,0.08),rgba(0,0,0,0.08))]",
};

const rimClasses: Record<ActionButtonVariant, string> = {
  share: "shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.16)]",
  upgrade: "shadow-[inset_0_0_0_0.5px_rgba(52,23,99,0.72)]",
  publish: "shadow-[inset_0_0_0_0.5px_rgba(12,50,133,0.82)]",
};

const secondaryHighlightClasses: Record<ActionButtonVariant, string> = {
  share:
    "shadow-[inset_0_0.5px_0_rgba(0,0,0,0.08),inset_0_-0.5px_0_rgba(0,0,0,0.14)]",
  upgrade:
    "shadow-[inset_0_0.5px_0_rgba(255,255,255,0.13),inset_0_-0.5px_0_rgba(0,0,0,0.12)]",
  publish:
    "shadow-[inset_0_0.5px_0_rgba(255,255,255,0.13),inset_0_-0.5px_0_rgba(0,0,0,0.12)]",
};

const layerClass =
  "pointer-events-none absolute inset-0 rounded-[inherit]";

function ActionButton({ variant, icon, children }: ActionButtonProps) {
  return (
    <button
      type="button"
      className={`group relative isolate inline-flex h-7 cursor-pointer items-center justify-center rounded-full border-0 px-[9px] py-1 text-xs font-normal leading-5 transition-[transform,color,background-color] duration-100 active:scale-[0.97] ${buttonVariantClasses[variant]}`}
    >
      <span
        data-allow-shadow
        aria-hidden="true"
        className={`${layerClass} -z-10 ${dropShadowClasses[variant]}`}
      />
      <span
        aria-hidden="true"
        className={`${layerClass} z-0 ${interactionClasses[variant]}`}
      />
      <span
        data-allow-shadow
        aria-hidden="true"
        className={`${layerClass} z-[1] ${spotlightClasses[variant]}`}
      />
      <span
        aria-hidden="true"
        className={`${layerClass} z-[2] ${domeClasses[variant]}`}
      />
      <span
        data-allow-shadow
        aria-hidden="true"
        className={`${layerClass} z-[3] ${rimClasses[variant]}`}
      />
      <span
        data-allow-shadow
        aria-hidden="true"
        className={`${layerClass} z-[4] ${secondaryHighlightClasses[variant]}`}
      />

      <span className="relative z-10 inline-flex items-center justify-center gap-1 whitespace-nowrap [&>svg]:size-4 [&>svg]:shrink-0">
        {icon}
        <span className="px-0.5">{children}</span>
      </span>
    </button>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.2506 22V19.75H16.0006C15.5864 19.75 15.2506 19.4142 15.2506 19C15.2506 18.5858 15.5864 18.25 16.0006 18.25H18.2506V16C18.2506 15.5858 18.5864 15.25 19.0006 15.25C19.4146 15.2502 19.7506 15.5859 19.7506 16V18.25H22.0006C22.4146 18.2502 22.7506 18.5859 22.7506 19C22.7506 19.4141 22.4146 19.7498 22.0006 19.75H19.7506V22C19.7506 22.4141 19.4146 22.7498 19.0006 22.75C18.5864 22.75 18.2506 22.4142 18.2506 22ZM12.0006 12.25C13.4602 12.2501 14.8278 12.6543 15.9947 13.3574C16.3494 13.5711 16.464 14.032 16.2506 14.3867C16.0368 14.7415 15.5751 14.8564 15.2203 14.6426C14.2805 14.0763 13.1798 13.7501 12.0006 13.75C9.16185 13.75 6.76251 15.6431 6.00158 18.2373C5.92731 18.4905 5.9923 18.717 6.16369 18.9043C6.34615 19.1037 6.65013 19.25 7.0006 19.25H12.0006C12.4146 19.2502 12.7506 19.5859 12.7506 20C12.7506 20.4141 12.4146 20.7498 12.0006 20.75H7.0006C6.24652 20.75 5.53531 20.4394 5.05724 19.917C4.56817 19.3826 4.32563 18.622 4.56212 17.8154C5.50533 14.5996 8.47805 12.25 12.0006 12.25ZM14.2506 7C14.2506 5.75749 13.2431 4.75021 12.0006 4.75C10.758 4.75 9.7506 5.75736 9.7506 7C9.7506 8.24264 10.758 9.25 12.0006 9.25C13.2431 9.24979 14.2506 8.24251 14.2506 7ZM15.7506 7C15.7506 9.07094 14.0715 10.7498 12.0006 10.75C9.92953 10.75 8.2506 9.07107 8.2506 7C8.2506 4.92893 9.92953 3.25 12.0006 3.25C14.0715 3.25021 15.7506 4.92906 15.7506 7Z" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.5459 1.27032C12.2766 0.393288 13.7498 0.896706 13.75 2.07891V9.24981H19.5371C20.5496 9.25007 21.1413 10.3914 20.5586 11.2195L12.5225 22.6395C11.8201 23.6376 10.2502 23.1411 10.25 21.9207V14.7498H4.46291C3.45043 14.7495 2.8587 13.6082 3.44143 12.7801L11.4776 1.36016L11.5459 1.27032Z" />
    </svg>
  );
}

function PublishIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3.25 17.0001V11.0001C3.25 10.5859 3.58579 10.2501 4 10.2501C4.41421 10.2501 4.75 10.5859 4.75 11.0001V17.0001C4.75 18.2428 5.75736 19.2501 7 19.2501H17C18.2426 19.2501 19.25 18.2428 19.25 17.0001V11.0001C19.25 10.5859 19.5858 10.2501 20 10.2501C20.4142 10.2501 20.75 10.5859 20.75 11.0001V17.0001C20.75 19.0712 19.0711 20.7501 17 20.7501H7C4.92893 20.7501 3.25 19.0712 3.25 17.0001ZM11.25 13.0001V4.81066L8.53027 7.53039C8.23738 7.82328 7.76262 7.82328 7.46973 7.53039C7.17683 7.2375 7.17683 6.76274 7.46973 6.46984L11.4697 2.46984L11.5264 2.41809C11.8209 2.17778 12.2557 2.19524 12.5303 2.46984L16.5303 6.46984C16.8232 6.76274 16.8232 7.2375 16.5303 7.53039C16.2374 7.82328 15.7626 7.82328 15.4697 7.53039L12.75 4.81066V13.0001C12.75 13.4143 12.4142 13.7501 12 13.7501C11.5858 13.7501 11.25 13.4143 11.25 13.0001Z" />
    </svg>
  );
}

export function EditorActions() {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-1.5">
      <ActionButton variant="share" icon={<ShareIcon />}>
        Share
      </ActionButton>
      <ActionButton variant="upgrade" icon={<BoltIcon />}>
        Upgrade
      </ActionButton>
      <ActionButton variant="publish" icon={<PublishIcon />}>
        Publish
      </ActionButton>
    </div>
  );
}
