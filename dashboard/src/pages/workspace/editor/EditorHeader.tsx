import type { ProjectRoute } from "../../../api";
import { EditorActions } from "../../../components/EditorActions";
import { PreviewRoutePicker } from "../../../components/PreviewRoutePicker";
import { Icon } from "../../../components/ui";
import { EditorIcon, roundIconButtonClass } from "./EditorIcon";
import type { ActiveProject } from "./types";
import { ViewSwitcher } from "./ViewSwitcher";

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
      <button className={roundIconButtonClass} type="button" aria-label="Desktop view">
        <EditorIcon name="monitor" size={14} />
      </button>
      <div className="flex h-7 min-w-[180px] max-w-[280px] flex-1 items-center rounded-full border border-black/[0.10] bg-white/85 px-1 shadow-[0_1px_2px_rgba(15,23,42,0.035)]">
        <button className={roundIconButtonClass} type="button" aria-label="Refresh preview" onClick={onRefresh}>
          <Icon name="refresh" size={13} />
        </button>
        <PreviewRoutePicker routes={routes} currentPath={currentRoute} onSelect={onRouteChange} />
      </div>
      <a className={`${roundIconButtonClass} no-underline`} href={previewUrl} target="_blank" rel="noreferrer" aria-label="Open preview in new tab">
        <Icon name="external" size={14} />
      </a>
    </div>
  );
}

export function EditorHeader({
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
          <button className={roundIconButtonClass} type="button" aria-label="Back to dashboard" onClick={onBack}>
            <EditorIcon name="menu" size={15} />
          </button>
          <button className="flex min-w-0 items-center gap-1.5 rounded-full border border-transparent bg-transparent px-2 py-1 text-sm font-medium transition hover:border-black/[0.08] hover:bg-black/[0.035]" type="button">
            <span className="max-w-[260px] truncate">{project.title}</span>
            <EditorIcon name="chevron" size={13} />
          </button>
        </div>
        <div className="flex items-center gap-1 pr-1">
          <button className={roundIconButtonClass} type="button" aria-label="History">
            <EditorIcon name="history" size={15} />
          </button>
          <button className={roundIconButtonClass} type="button" aria-label="Toggle chat panel">
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
