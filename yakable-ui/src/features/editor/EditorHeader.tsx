import type { ProjectRoute } from "@/features/project/model/types";
import type { PreviewHeaderMode } from "./adaptive-header";
import { EditorIcon, roundIconButtonClass } from "./EditorIcon";
import { PreviewExpandButton } from "./PreviewExpandButton";
import { PreviewToolbar } from "./PreviewToolbar";
import type { ActiveProject } from "./types";

export function EditorHeader({
  project,
  onBack,
  onRefresh,
  previewUrl,
  routes,
  currentRoute,
  onRouteChange,
  previewHeaderMode,
  onRestorePreview,
}: {
  project: ActiveProject;
  onBack: () => void;
  onRefresh: () => void;
  previewUrl: string;
  routes: ProjectRoute[];
  currentRoute: string;
  onRouteChange: (path: string) => void;
  previewHeaderMode: PreviewHeaderMode;
  onRestorePreview: () => void;
}) {
  const collapsed = previewHeaderMode === "collapsed";

  return (
    <header className="relative grid h-12 shrink-0 [grid-template-columns:var(--editor-chat-width)_minmax(0,1fr)] items-center bg-[#f6f6f4] max-[900px]:grid-cols-[1fr_auto]">
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
        <div className={`flex items-center gap-1 pr-1 ${collapsed ? "mr-9" : ""}`}>
          <button className={roundIconButtonClass} type="button" aria-label="History">
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

      {collapsed ? (
        <div className="absolute right-2 top-1/2 z-20 -translate-y-1/2 max-[900px]:hidden">
          <PreviewExpandButton onClick={onRestorePreview} />
        </div>
      ) : (
        <div className="flex min-w-0 items-center pr-2 max-[900px]:hidden">
          <PreviewToolbar
            mode={previewHeaderMode}
            onRefresh={onRefresh}
            previewUrl={previewUrl}
            routes={routes}
            currentRoute={currentRoute}
            onRouteChange={onRouteChange}
          />
        </div>
      )}
    </header>
  );
}
