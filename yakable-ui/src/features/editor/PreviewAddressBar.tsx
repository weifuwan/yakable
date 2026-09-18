import type { ProjectRoute } from "@/features/project/model/types";
import { PreviewRoutePicker } from "./PreviewRoutePicker";
import { Icon } from "@/shared/ui";
import type { PreviewHeaderMode } from "./adaptive-header";
import { EditorIcon, roundIconButtonClass } from "./EditorIcon";

type VisiblePreviewHeaderMode = Exclude<PreviewHeaderMode, "collapsed">;

export function PreviewAddressBar({
  mode,
  onRefresh,
  previewUrl,
  routes,
  currentRoute,
  onRouteChange,
}: {
  mode: VisiblePreviewHeaderMode;
  onRefresh: () => void;
  previewUrl: string;
  routes: ProjectRoute[];
  currentRoute: string;
  onRouteChange: (path: string) => void;
}) {
  const showDeviceToggle = mode === "full";
  const showExternalLink = mode !== "tight";
  const addressWidthClass =
    mode === "full"
      ? "min-w-[180px] max-w-[280px]"
      : mode === "compact"
        ? "min-w-[120px] max-w-[220px]"
        : "min-w-[86px] max-w-[160px]";

  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
      <div
        className={`overflow-hidden transition-[width,opacity,margin] duration-200 ${
          showDeviceToggle ? "mr-0 w-7 opacity-100" : "-mr-1 w-0 opacity-0"
        }`}
        aria-hidden={!showDeviceToggle}
      >
        <button
          className={roundIconButtonClass}
          type="button"
          aria-label="Desktop view"
          tabIndex={showDeviceToggle ? 0 : -1}
        >
          <EditorIcon name="monitor" size={14} />
        </button>
      </div>

      <div
        className={`flex h-7 flex-1 items-center rounded-full border border-black/[0.10] bg-white/85 px-1 shadow-[0_1px_2px_rgba(15,23,42,0.035)] transition-[min-width,max-width] duration-200 ${addressWidthClass}`}
      >
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

      <div
        className={`overflow-hidden transition-[width,opacity,margin] duration-200 ${
          showExternalLink ? "ml-0 w-7 opacity-100" : "-ml-1 w-0 opacity-0"
        }`}
        aria-hidden={!showExternalLink}
      >
        <a
          className={`${roundIconButtonClass} no-underline`}
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Open preview in new tab"
          tabIndex={showExternalLink ? 0 : -1}
        >
          <Icon name="external" size={14} />
        </a>
      </div>
    </div>
  );
}
