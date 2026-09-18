import type { ProjectRoute } from "../../../api";
import { EditorActions } from "../../../components/EditorActions";
import type { PreviewHeaderMode } from "./adaptive-header";
import { PreviewAddressBar } from "./PreviewAddressBar";
import { ViewSwitcher } from "./ViewSwitcher";

type VisiblePreviewHeaderMode = Exclude<PreviewHeaderMode, "collapsed">;

export function PreviewToolbar({
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
  return (
    <div
      data-editor-preview-toolbar="true"
      className={`flex min-w-0 flex-1 items-center transition-[gap,opacity,transform] duration-200 ${
        mode === "tight" ? "gap-1" : "gap-2"
      }`}
    >
      <ViewSwitcher mode={mode} />
      <PreviewAddressBar
        mode={mode}
        onRefresh={onRefresh}
        previewUrl={previewUrl}
        routes={routes}
        currentRoute={currentRoute}
        onRouteChange={onRouteChange}
      />
      <EditorActions compact={mode !== "full"} />
    </div>
  );
}
