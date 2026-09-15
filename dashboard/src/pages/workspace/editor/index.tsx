import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { editProject, type ProjectRoute } from "../../../api";
import { getCurrentPreviewSelections } from "../../../visual-edit-context";
import {
  resolvePreviewHeaderMode,
  restoredChatWidth,
  shouldCollapsePreviewPanel,
} from "./adaptive-header";
import { ChatComposer, ChatTimeline } from "./ChatPanel";
import { EditorHeader } from "./EditorHeader";
import { PreviewInteractionToolbar } from "./PreviewInteractionToolbar";
import { WorkspaceResizer } from "./WorkspaceResizer";
import type { ActiveProject, ChatMessage } from "./types";
import {
  DEFAULT_CHAT_WIDTH,
  FALLBACK_ROUTES,
  buildPreviewUrl,
  clampChatWidth,
  conversationMessages,
  persistedSelection,
} from "./utils";

export type { ActiveProject } from "./types";

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
  const [currentRoute, setCurrentRoute] = useState(project.routes[0]?.path ?? "/");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [panelsWidth, setPanelsWidth] = useState(0);
  const panelsRef = useRef<HTMLDivElement>(null);
  const previewUrl = buildPreviewUrl(runtimeUrl, currentRoute);
  const previewWidth =
    panelsWidth > 0
      ? panelsWidth * (1 - chatWidth / 100)
      : Number.POSITIVE_INFINITY;
  const measuredPreviewHeaderMode = resolvePreviewHeaderMode(previewWidth);
  const previewHeaderMode = previewCollapsed
    ? "collapsed"
    : measuredPreviewHeaderMode === "collapsed"
      ? "tight"
      : measuredPreviewHeaderMode;
  const layoutChatWidth = previewCollapsed ? 100 : chatWidth;
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    conversationMessages(project.conversation, project.summary),
  );

  useEffect(() => {
    const panels = panelsRef.current;
    if (!panels) return;

    function updatePanelsWidth() {
      setPanelsWidth(panels.getBoundingClientRect().width);
    }

    updatePanelsWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updatePanelsWidth);
      return () => window.removeEventListener("resize", updatePanelsWidth);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setPanelsWidth(entry?.contentRect.width ?? panels.getBoundingClientRect().width);
    });
    observer.observe(panels);
    return () => observer.disconnect();
  }, []);

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

      const rawPreviewWidth = Math.max(0, rect.right - event.clientX);
      if (shouldCollapsePreviewPanel(rawPreviewWidth)) {
        setPreviewCollapsed(true);
        setIsResizing(false);
        return;
      }

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

    const selections = getCurrentPreviewSelections();
    const createdAt = new Date().toISOString();
    setPrompt("");
    setMessages((current) => [
      ...current,
      {
        id: `pending-user-${createdAt}`,
        role: "user",
        content: request,
        createdAt,
        visualSelections: selections.map(persistedSelection),
      },
    ]);
    setBusy(true);

    try {
      const result = await editProject(project.id, request, selections);
      setRuntimeUrl(result.previewUrl);
      const nextRoutes = result.routes.length ? result.routes : routes;
      setRoutes(nextRoutes);
      setCurrentRoute((current) =>
        nextRoutes.some((route) => route.path === current)
          ? current
          : (nextRoutes[0]?.path ?? "/"),
      );

      if (result.conversation) {
        setMessages(conversationMessages(result.conversation, result.summary));
      } else {
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: result.changedFiles.length
              ? `${result.summary}\nChanged: ${result.changedFiles.join(", ")}`
              : result.summary,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (caught) {
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: "error",
          content: caught instanceof Error ? caught.message : "Edit failed.",
          createdAt: new Date().toISOString(),
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

  function collapsePreview() {
    setIsResizing(false);
    setPreviewCollapsed(true);
  }

  function restorePreviewToolbar() {
    const width = panelsRef.current?.getBoundingClientRect().width ?? panelsWidth;
    setChatWidth(restoredChatWidth(width));
    setPreviewCollapsed(false);
  }

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-[#f6f6f4] font-sans text-[#252522] antialiased"
      style={{ "--editor-chat-width": `${layoutChatWidth}%` } as CSSProperties}
    >
      <EditorHeader
        project={project}
        onBack={onBack}
        onRefresh={refreshPreview}
        previewUrl={previewUrl}
        routes={routes}
        currentRoute={currentRoute}
        onRouteChange={setCurrentRoute}
        previewHeaderMode={previewHeaderMode}
        onRestorePreview={restorePreviewToolbar}
      />

      <div
        ref={panelsRef}
        className="relative grid min-h-0 flex-1 [grid-template-columns:var(--editor-chat-width)_minmax(0,1fr)] transition-[grid-template-columns] duration-200 ease-out max-[900px]:grid-cols-1 max-[900px]:grid-rows-[45%_55%]"
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

        {!previewCollapsed ? (
          <WorkspaceResizer
            chatWidth={chatWidth}
            isResizing={isResizing}
            setChatWidth={setChatWidth}
            onResizeStart={() => setIsResizing(true)}
            onCollapsePreview={collapsePreview}
          />
        ) : null}

        {isResizing && !previewCollapsed ? (
          <div className="absolute inset-0 z-20 cursor-col-resize" aria-hidden="true" />
        ) : null}

        <section
          aria-hidden={previewCollapsed}
          className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl bg-white transition-[opacity,margin,border-color,box-shadow] duration-150 max-[900px]:m-2 ${
            previewCollapsed
              ? "invisible m-0 pointer-events-none border border-transparent opacity-0 shadow-none"
              : "visible mb-2 mr-2 border border-black/[0.08] opacity-100 shadow-[0_3px_14px_rgba(15,23,42,0.07)]"
          }`}
        >
          <iframe
            className="min-h-0 w-full flex-1 border-0 bg-white"
            key={previewUrl}
            title={`${project.title} preview`}
            src={previewUrl}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
            tabIndex={previewCollapsed ? -1 : 0}
          />
          <PreviewInteractionToolbar />
        </section>
      </div>
    </div>
  );
}
