import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ModelSelector, type ModelSelection } from '@/features/model';
import { ProjectHeader } from '@/features/project';
import {
  SessionService,
  type SessionChanges,
  type SessionInfo,
  type SessionMessage,
  type SessionTurn,
} from '@/service/session';
import { cx, Icon, IconButton, PromptComposer, PromptComposerSkeleton } from '@/shared/ui';

import { buildTurnRenderModels, type OptimisticTurnRenderInput, TurnItem } from './TurnItem';
import { TurnNavigator } from './turn-navigator/TurnNavigator';
import { useTurnNavigator } from './turn-navigator/useTurnNavigator';
import { useSessionMessageWindow } from '../hooks/useSessionMessageWindow';
import { useSessionViewport } from '../hooks/useSessionViewport';
import { useTurnStream } from '../hooks/useTurnStream';
import { useTurnWindowing } from '../hooks/useTurnWindowing';

function hasActiveTurn(turns: SessionTurn[]) {
  return turns.some((turn) => turn.status === 'PENDING' || turn.status === 'RUNNING');
}

function latestActiveTurnId(turns: SessionTurn[]) {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn.status === 'PENDING' || turn.status === 'RUNNING') {
      return turn.id;
    }
  }
  return null;
}

function mergeTurn(turns: SessionTurn[], next: SessionTurn) {
  return turns.some((turn) => turn.id === next.id)
    ? turns.map((turn) => (turn.id === next.id ? next : turn))
    : [...turns, next];
}

function SessionLoadingIndicator() {
  return (
    <output className="flex h-full items-center justify-center" aria-label="Loading session">
      <svg
        aria-hidden="true"
        className="size-5 animate-spin text-loading"
        viewBox="0 0 24 24"
        fill="none"
      >
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 3v3" />
          <path d="m18.36 5.64-2.12 2.12" />
          <path d="M21 12h-3" />
          <path d="m18.36 18.36-2.12-2.12" />
          <path d="M12 21v-3" />
          <path d="m5.64 18.36 2.12-2.12" />
          <path d="M3 12h3" />
          <path d="m5.64 5.64 2.12 2.12" />
        </g>
      </svg>
    </output>
  );
}

interface SessionWorkspaceProps {
  projectId: string;
  sessionId: string;
  onActivity?: (sessionId: string, updatedAt: string) => void;
}

export function SessionWorkspace(props: SessionWorkspaceProps) {
  return <SessionWorkspaceContent key={props.projectId + ':' + props.sessionId} {...props} />;
}

function SessionWorkspaceContent({ projectId, sessionId, onActivity }: SessionWorkspaceProps) {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [turns, setTurns] = useState<SessionTurn[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [optimisticTurn, setOptimisticTurn] = useState<OptimisticTurnRenderInput | null>(null);
  const [latestSequence, setLatestSequence] = useState(0);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelSelection | null>(null);
  const pendingRequestRef = useRef<{
    fingerprint: string;
    requestId: string;
  } | null>(null);
  const {
    messages,
    hasNewer,
    isLoadingOlder,
    initialize: initializeMessageWindow,
    replaceWindow,
    mergeMessages,
    restoreLatest,
    loadOlder,
    loadNewer,
  } = useSessionMessageWindow(projectId, sessionId);
  const loadedSessionId = sessionInfo?.id ?? null;
  const messageCount = messages.length;

  useEffect(() => {
    if (!expanded) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [expanded]);

  const {
    scrollRef,
    showScrollBottom,
    setFollowLatest,
    isFollowingLatest,
    handleScroll,
    syncToContent,
    restoreLatestView: restoreViewportLatestView,
  } = useSessionViewport({
    hasNewer,
    loadOlder,
    loadNewer,
    restoreLatest,
    onError: setLoadError,
  });

  useEffect(() => {
    const controller = new AbortController();

    void SessionService.querySession(projectId, sessionId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setSessionInfo(result.session);
        setTurns(result.turns);
        initializeMessageWindow(result);
        setLatestSequence(result.messages.at(-1)?.sequence ?? 0);
        setSelectedModel(result.session.model);
        setIsSessionLoading(false);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(
          requestError instanceof Error ? requestError.message : 'Unable to load session.',
        );
        setIsSessionLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [initializeMessageWindow, projectId, sessionId]);

  const activeTurn = hasActiveTurn(turns);
  const activeTurnId = latestActiveTurnId(turns);
  const renderedTurnIdsRef = useRef(new Set<string>());

  const applyChanges = useCallback(
    (changes: SessionChanges) => {
      setTurns((current) => mergeTurn(current, changes.latestTurn));
      setLatestSequence((current) => Math.max(current, changes.latestSequence));

      const affectsRenderedTurn = changes.messages.some((message) =>
        renderedTurnIdsRef.current.has(message.turnId),
      );
      if (isFollowingLatest() || affectsRenderedTurn) {
        mergeMessages(changes.messages);
      }
    },
    [isFollowingLatest, mergeMessages],
  );

  const {
    streamingContent,
    visibleStreamingTurnId,
    generating,
    startStreamingTurn,
    stopStreamingTurn,
  } = useTurnStream({
    projectId,
    sessionId,
    activeTurn,
    activeTurnId,
    latestSequence,
    applyChanges,
    onLoadError: setLoadError,
    onSendError: setSendError,
  });

  useEffect(() => {
    syncToContent(loadedSessionId);
  }, [loadedSessionId, messageCount, optimisticTurn?.key, streamingContent, syncToContent]);

  const latestTurn = useMemo(() => turns.at(-1) ?? null, [turns]);

  const streamingMessage = useMemo<SessionMessage | null>(() => {
    if (!visibleStreamingTurnId || !streamingContent) return null;

    const turnIsRendered = messages.some((message) => message.turnId === visibleStreamingTurnId);
    if (!turnIsRendered) return null;

    return {
      id: 'stream-' + visibleStreamingTurnId,
      turnId: visibleStreamingTurnId,
      role: 'ASSISTANT',
      content: streamingContent,
      sequence: Number.MAX_SAFE_INTEGER,
      createdAt: new Date().toISOString(),
    };
  }, [messages, streamingContent, visibleStreamingTurnId]);

  const turnModels = useMemo(
    () =>
      buildTurnRenderModels({
        messages,
        turns,
        optimisticTurn,
        streamingMessage,
        activeTurnId,
        latestTurnId: latestTurn?.id ?? null,
        showThinking: generating && !streamingContent,
      }),
    [
      activeTurnId,
      generating,
      latestTurn?.id,
      messages,
      optimisticTurn,
      streamingContent,
      streamingMessage,
      turns,
    ],
  );

  const renderedTurnIds = useMemo(
    () => turnModels.flatMap((turn) => (turn.turnId ? [turn.turnId] : [])),
    [turnModels],
  );

  useEffect(() => {
    renderedTurnIdsRef.current = new Set(renderedTurnIds);
  }, [renderedTurnIds]);

  const turnNavigator = useTurnNavigator({
    projectId,
    sessionId,
    scrollRef,
    renderedTurnIds,
    navigationRefreshKey: turns.length,
    replaceWindow,
    onFollowLatestChange: setFollowLatest,
  });

  const turnKeys = useMemo(() => turnModels.map((turn) => turn.key), [turnModels]);
  const currentNavigationTurnId = turnNavigator.currentTurnId;
  const activeJumpTurnId = turnNavigator.activeJumpTurnId;

  const pinnedTurnKeys = useMemo(() => {
    const keys = new Set<string>();

    if (optimisticTurn) keys.add(optimisticTurn.key);
    if (activeTurnId) keys.add('turn:' + activeTurnId);
    if (visibleStreamingTurnId) keys.add('turn:' + visibleStreamingTurnId);
    if (currentNavigationTurnId) keys.add('turn:' + currentNavigationTurnId);
    if (activeJumpTurnId) keys.add('turn:' + activeJumpTurnId);

    return [...keys];
  }, [
    activeJumpTurnId,
    activeTurnId,
    currentNavigationTurnId,
    optimisticTurn,
    visibleStreamingTurnId,
  ]);

  const turnWindowing = useTurnWindowing({
    scrollRef,
    turnKeys,
    pinnedTurnKeys,
  });

  const cancelNavigationJump = turnNavigator.cancelJump;

  const restoreLatestView = useCallback(
    (scrollAfterRestore: boolean) => {
      restoreViewportLatestView(scrollAfterRestore, cancelNavigationJump);
    },
    [cancelNavigationJump, restoreViewportLatestView],
  );

  const handleSubmit = useCallback(
    (content: string) => {
      if (!selectedModel) return false;

      restoreLatestView(false);

      const fingerprint = [selectedModel.provider, selectedModel.model, content].join('\n');
      const currentRequest = pendingRequestRef.current;
      const pendingRequest =
        currentRequest?.fingerprint === fingerprint
          ? currentRequest
          : {
              fingerprint,
              requestId: globalThis.crypto.randomUUID(),
            };
      pendingRequestRef.current = pendingRequest;
      const requestId = pendingRequest.requestId;

      setOptimisticTurn({
        key: 'optimistic:' + requestId,
        message: {
          id: 'optimistic-user-' + requestId,
          turnId: 'optimistic',
          role: 'USER',
          content,
          sequence: latestSequence + 1,
          createdAt: new Date().toISOString(),
        },
      });

      return startStreamingTurn({
        content,
        model: selectedModel,
        requestId,
        afterSequence: latestSequence,
        onStarted: (started) => {
          if (pendingRequestRef.current?.requestId === requestId) {
            pendingRequestRef.current = null;
          }
          setOptimisticTurn(null);
          onActivity?.(sessionId, started.userMessage.createdAt);
          setSessionInfo((current) => (current ? { ...current, model: selectedModel } : current));
          setTurns((current) => mergeTurn(current, started.turn));
          setLatestSequence((current) => Math.max(current, started.userMessage.sequence));
          mergeMessages([started.userMessage]);
        },
        onRejected: () => setOptimisticTurn(null),
      });
    },
    [
      latestSequence,
      mergeMessages,
      onActivity,
      restoreLatestView,
      selectedModel,
      sessionId,
      startStreamingTurn,
    ],
  );

  const handleStop = useCallback(() => {
    stopStreamingTurn(
      activeTurnId,
      (stopped) => setTurns((current) => mergeTurn(current, stopped)),
      () => setOptimisticTurn(null),
    );
  }, [activeTurnId, stopStreamingTurn]);

  return (
    <div
      className={cx(
        'flex min-h-0 flex-col bg-workspace',
        expanded ? 'fixed inset-0 z-50 h-screen' : 'h-full',
      )}
    >
      <ProjectHeader
        title={sessionInfo?.title ?? 'Project'}
        loading={isSessionLoading}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((current) => !current)}
      />

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          data-testid="session-message-scroll"
          className="h-full overflow-y-auto"
          onScroll={handleScroll}
        >
          {isSessionLoading ? (
            <SessionLoadingIndicator />
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
              {loadError && (
                <div
                  className="rounded-xl border border-warning-border bg-warning-surface px-4 py-3 text-sm text-warning"
                  role="alert"
                >
                  {loadError}
                </div>
              )}

              {isLoadingOlder && (
                <output className="block text-center text-xs text-foreground-subtle">
                  Loading earlier messages...
                </output>
              )}

              {turnModels.map((turn) => (
                <TurnItem
                  key={turn.key}
                  turn={turn}
                  mounted={turnWindowing.isTurnMounted(turn.key)}
                  placeholderHeight={turnWindowing.measuredHeight(turn.key)}
                  onMeasure={turnWindowing.reportTurnHeight}
                />
              ))}
            </div>
          )}
        </div>

        {!isSessionLoading && (
          <TurnNavigator
            items={turnNavigator.items}
            currentTurnId={turnNavigator.currentTurnId}
            isJumping={turnNavigator.isJumping}
            onJumpTurn={(item, options) => {
              void turnNavigator.jumpToTurn(item, options);
            }}
          />
        )}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10"
          style={{
            background:
              'linear-gradient(to bottom, var(--workspace-fade-strong) 0%, var(--workspace-fade-soft) 45%, var(--workspace-fade-transparent) 100%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10"
          style={{
            background:
              'linear-gradient(to top, var(--workspace-fade-strong) 0%, var(--workspace-fade-soft) 45%, var(--workspace-fade-transparent) 100%)',
          }}
        />

        {!isSessionLoading && showScrollBottom && (
          <IconButton
            aria-label="Scroll to bottom"
            variant="secondary"
            size="md"
            data-allow-shadow="true"
            className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 cursor-pointer hover:shadow-md"
            style={{ borderRadius: '50%', backgroundColor: 'var(--surface)' }}
            onClick={() => restoreLatestView(true)}
          >
            {generating ? (
              <span aria-hidden="true" className="flex items-center gap-1">
                <span className="size-1 rounded-full bg-current" />
                <span className="size-1 rounded-full bg-current" />
                <span className="size-1 rounded-full bg-current" />
              </span>
            ) : (
              <Icon size={18}>
                <path d="M12 5v14" />
                <path d="m6 13 6 6 6-6" />
              </Icon>
            )}
          </IconButton>
        )}
      </div>

      <div className="shrink-0 bg-workspace px-6 py-4">
        <div className="mx-auto w-full max-w-3xl">
          {isSessionLoading ? (
            <PromptComposerSkeleton />
          ) : (
            <PromptComposer
              ariaLabel="Send a message"
              placeholder="Ask Yakable..."
              submitLabel="Send message"
              submitTooltip="Send prompt"
              disabled={!sessionInfo}
              running={generating}
              trailingActions={
                selectedModel ? (
                  <ModelSelector
                    surface="chassis"
                    disabled={!sessionInfo}
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                  />
                ) : undefined
              }
              onStop={handleStop}
              onSubmit={handleSubmit}
            />
          )}

          {sendError && (
            <p className="mb-0 mt-2 px-2 text-sm text-danger" role="alert">
              {sendError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
