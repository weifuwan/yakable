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
import { useTurnWindowing } from '../hooks/useTurnWindowing';

const SESSION_POLL_INTERVAL_MS = 1000;
const ACTIVE_TURN_REWATCH_DELAY_MS = 1000;
const SCROLL_BOTTOM_THRESHOLD_PX = 120;
const HISTORY_LOAD_THRESHOLD_PX = 80;

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

function isNearBottom(element: HTMLElement) {
  return (
    element.scrollHeight - element.scrollTop - element.clientHeight <= SCROLL_BOTTOM_THRESHOLD_PX
  );
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
  const [streamingTurnId, setStreamingTurnId] = useState<string | null>(null);
  const [watchedTurnId, setWatchedTurnId] = useState<string | null>(null);
  const [watchRetryVersion, setWatchRetryVersion] = useState(0);
  const [streamingContent, setStreamingContent] = useState('');
  const [optimisticTurn, setOptimisticTurn] = useState<OptimisticTurnRenderInput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [latestSequence, setLatestSequence] = useState(0);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelSelection | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const currentTurnIdRef = useRef<string | null>(null);
  const watchedTurnIdsRef = useRef(new Set<string>());
  const stopRequestedRef = useRef(false);
  const followOutputRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
  const latestSequenceRef = useRef(0);
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
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

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

  const setFollowLatest = useCallback((followLatest: boolean) => {
    followOutputRef.current = followLatest;
    setShowScrollBottom(!followLatest);
  }, []);

  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    setFollowLatest(true);
    element.scrollTop = element.scrollHeight;
  }, [setFollowLatest]);

  const loadOlderMessages = useCallback(async () => {
    const element = scrollRef.current;
    if (!element) return;

    const previousScrollHeight = element.scrollHeight;

    try {
      const loaded = await loadOlder();
      if (!loaded) return;

      window.requestAnimationFrame(() => {
        const currentElement = scrollRef.current;
        if (!currentElement) return;
        currentElement.scrollTop += currentElement.scrollHeight - previousScrollHeight;
      });
    } catch (requestError) {
      setLoadError(
        requestError instanceof Error ? requestError.message : 'Unable to load earlier messages.',
      );
    }
  }, [loadOlder]);

  const loadNewerMessages = useCallback(async () => {
    try {
      await loadNewer();
    } catch (requestError) {
      setLoadError(
        requestError instanceof Error ? requestError.message : 'Unable to load newer messages.',
      );
    }
  }, [loadNewer]);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const nearBottom = isNearBottom(element);
    setFollowLatest(nearBottom);

    if (element.scrollTop <= HISTORY_LOAD_THRESHOLD_PX) {
      void loadOlderMessages();
    }

    if (
      hasNewer &&
      element.scrollHeight - element.scrollTop - element.clientHeight <= HISTORY_LOAD_THRESHOLD_PX
    ) {
      void loadNewerMessages();
    }
  }, [hasNewer, loadNewerMessages, loadOlderMessages, setFollowLatest]);

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

  useEffect(() => {
    if (!loadedSessionId) return;

    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      scrollToBottom();
      return;
    }

    if (followOutputRef.current) {
      scrollToBottom();
    }
  }, [loadedSessionId, messageCount, optimisticTurn, scrollToBottom, streamingContent]);

  const activeTurn = hasActiveTurn(turns);
  const activeTurnId = latestActiveTurnId(turns);
  const generating = isGenerating || activeTurn;
  const visibleStreamingTurnId = streamingTurnId ?? watchedTurnId;

  useEffect(() => {
    latestSequenceRef.current = latestSequence;
  }, [latestSequence]);

  const renderedTurnIdsRef = useRef(new Set<string>());

  const applyChanges = useCallback(
    (changes: SessionChanges) => {
      setTurns((current) => mergeTurn(current, changes.latestTurn));
      setLatestSequence((current) => Math.max(current, changes.latestSequence));

      const affectsRenderedTurn = changes.messages.some((message) =>
        renderedTurnIdsRef.current.has(message.turnId),
      );
      if (followOutputRef.current || affectsRenderedTurn) {
        mergeMessages(changes.messages);
      }
    },
    [mergeMessages],
  );

  useEffect(() => {
    if (!activeTurnId || streamAbortRef.current || watchedTurnIdsRef.current.has(activeTurnId)) {
      return;
    }

    watchedTurnIdsRef.current.add(activeTurnId);
    const controller = new AbortController();
    let disposed = false;
    let retryTimer: number | null = null;
    const afterSequence = latestSequenceRef.current;

    const scheduleRewatch = () => {
      if (disposed || retryTimer !== null) return;

      retryTimer = window.setTimeout(() => {
        if (disposed) return;
        retryTimer = null;
        watchedTurnIdsRef.current.delete(activeTurnId);
        setWatchRetryVersion((current) => current + 1);
      }, ACTIVE_TURN_REWATCH_DELAY_MS);
    };

    setWatchedTurnId(activeTurnId);

    void SessionService.watchTurn(
      projectId,
      sessionId,
      activeTurnId,
      {
        onSnapshot: (content) => {
          if (!disposed) setStreamingContent(content);
        },
        onDelta: (delta) => {
          if (!disposed) {
            setStreamingContent((current) => current + delta);
          }
        },
      },
      controller.signal,
    )
      .then(async () => {
        if (disposed) return;
        try {
          const changes = await SessionService.queryChanges(projectId, sessionId, afterSequence);
          if (disposed) return;
          applyChanges(changes);
          setStreamingContent('');
          setLoadError(null);
        } catch {
          // terminal watcher 已结束；持久化状态暂不可读时由 polling 继续收敛。
        }
      })
      .catch(async () => {
        if (disposed || controller.signal.aborted) return;

        let shouldRewatch = true;
        try {
          const changes = await SessionService.queryChanges(projectId, sessionId, afterSequence);
          if (disposed) return;

          applyChanges(changes);
          setLoadError(null);

          shouldRewatch =
            changes.latestTurn.status === 'PENDING' || changes.latestTurn.status === 'RUNNING';
          if (!shouldRewatch) {
            setStreamingContent('');
          }
        } catch {
          // 数据库状态也暂时不可读时保留现有 partial，并继续尝试同一 Turn。
        }

        if (shouldRewatch) {
          scheduleRewatch();
        }
      })
      .finally(() => {
        if (disposed) return;
        setWatchedTurnId(null);
      });

    return () => {
      disposed = true;
      controller.abort();
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [activeTurnId, applyChanges, projectId, sessionId, watchRetryVersion]);

  useEffect(() => {
    if (!activeTurn || streamingTurnId || watchedTurnId) return;

    let disposed = false;

    const timer = window.setInterval(() => {
      void SessionService.queryChanges(projectId, sessionId, latestSequence)
        .then((changes) => {
          if (disposed) return;
          applyChanges(changes);
          setLoadError(null);
        })
        .catch((requestError: unknown) => {
          if (disposed) return;
          setLoadError(
            requestError instanceof Error ? requestError.message : 'Unable to refresh session.',
          );
        });
    }, SESSION_POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [
    activeTurn,
    applyChanges,
    latestSequence,
    projectId,
    sessionId,
    streamingTurnId,
    watchedTurnId,
  ]);

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
    restoreLatestWindow: restoreLatest,
    onFollowLatestChange: setFollowLatest,
  });

  const turnKeys = useMemo(() => turnModels.map((turn) => turn.key), [turnModels]);

  const pinnedTurnKeys = useMemo(() => {
    const keys = new Set<string>();

    if (optimisticTurn) keys.add(optimisticTurn.key);
    if (activeTurnId) keys.add('turn:' + activeTurnId);
    if (visibleStreamingTurnId) keys.add('turn:' + visibleStreamingTurnId);
    if (turnNavigator.currentTurnId) keys.add('turn:' + turnNavigator.currentTurnId);
    if (turnNavigator.activeJumpTurnId) keys.add('turn:' + turnNavigator.activeJumpTurnId);

    return [...keys];
  }, [
    activeTurnId,
    optimisticTurn,
    turnNavigator.activeJumpTurnId,
    turnNavigator.currentTurnId,
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
      cancelNavigationJump();
      setFollowLatest(true);

      if (!hasNewer) {
        if (scrollAfterRestore) {
          scrollToBottom();
        }
        return;
      }

      void restoreLatest()
        .then((restored) => {
          if (!restored || !scrollAfterRestore) return;

          window.requestAnimationFrame(() => {
            scrollToBottom();
          });
        })
        .catch((requestError: unknown) => {
          setLoadError(
            requestError instanceof Error ? requestError.message : 'Unable to return to latest.',
          );
        });
    },
    [hasNewer, restoreLatest, scrollToBottom, setFollowLatest, cancelNavigationJump],
  );

  const runStreamingTurn = useCallback(
    async (
      content: string,
      model: ModelSelection,
      requestId: string,
      controller: AbortController,
      afterSequence: number,
      onEstablished: () => void,
      onRejected: () => void,
    ) => {
      let established = false;

      try {
        await SessionService.streamingTurn(
          projectId,
          sessionId,
          content,
          model,
          requestId,
          {
            onStarted: (started) => {
              established = true;
              onEstablished();
              currentTurnIdRef.current = started.turn.id;
              setStreamingTurnId(started.turn.id);
              setOptimisticTurn(null);
              onActivity?.(sessionId, started.userMessage.createdAt);
              setSessionInfo((current) => (current ? { ...current, model } : current));
              setTurns((current) => mergeTurn(current, started.turn));
              setLatestSequence((current) => Math.max(current, started.userMessage.sequence));
              mergeMessages([started.userMessage]);
            },
            onSnapshot: (content) => {
              setStreamingContent(content);
            },
            onDelta: (delta) => {
              setStreamingContent((current) => current + delta);
            },
          },
          controller.signal,
        );

        const changes = await SessionService.queryChanges(projectId, sessionId, afterSequence);
        applyChanges(changes);
      } catch (requestError) {
        if (!established) {
          setOptimisticTurn(null);
        }
        if (controller.signal.aborted && stopRequestedRef.current) return;

        try {
          const changes = await SessionService.queryChanges(projectId, sessionId, afterSequence);
          applyChanges(changes);
        } catch {
          // 保留原始流式错误。
        }

        if (!established) {
          setSendError(
            requestError instanceof Error ? requestError.message : 'Unable to stream turn.',
          );
        }
      } finally {
        if (!established) {
          onRejected();
        }
        const stopped = controller.signal.aborted && stopRequestedRef.current;
        if (streamAbortRef.current === controller) {
          streamAbortRef.current = null;
        }
        currentTurnIdRef.current = null;
        setIsGenerating(false);
        if (!stopped) {
          setStreamingTurnId(null);
          setStreamingContent('');
        }
      }
    },
    [applyChanges, mergeMessages, onActivity, projectId, sessionId],
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

      const controller = new AbortController();
      streamAbortRef.current = controller;
      currentTurnIdRef.current = null;
      stopRequestedRef.current = false;
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
      setIsGenerating(true);
      setSendError(null);
      setStreamingContent('');

      return new Promise<boolean>((resolve) => {
        let settled = false;
        const settle = (accepted: boolean) => {
          if (settled) return;
          settled = true;
          resolve(accepted);
        };

        void runStreamingTurn(
          content,
          selectedModel,
          requestId,
          controller,
          latestSequence,
          () => {
            if (pendingRequestRef.current?.requestId === requestId) {
              pendingRequestRef.current = null;
            }
            settle(true);
          },
          () => settle(false),
        );
      });
    },
    [latestSequence, restoreLatestView, runStreamingTurn, selectedModel],
  );

  const handleStop = useCallback(() => {
    const turnId = currentTurnIdRef.current ?? activeTurnId;
    stopRequestedRef.current = true;
    streamAbortRef.current?.abort();

    if (!turnId) {
      setOptimisticTurn(null);
      setIsGenerating(false);
      return;
    }

    void SessionService.stopTurn(projectId, sessionId, turnId)
      .then(async (stopped) => {
        setTurns((current) => mergeTurn(current, stopped));
        setSendError(null);

        try {
          const changes = await SessionService.queryChanges(projectId, sessionId, latestSequence);
          applyChanges(changes);
          setStreamingTurnId(null);
          setStreamingContent('');
        } catch {
          // 保留当前已生成内容，刷新页面后会从后端恢复。
        }
      })
      .catch((requestError: unknown) => {
        setSendError(
          requestError instanceof Error ? requestError.message : 'Unable to stop generation.',
        );
      })
      .finally(() => {
        setIsGenerating(false);
      });
  }, [activeTurnId, applyChanges, latestSequence, projectId, sessionId]);

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
            visibleTurnIds={turnNavigator.visibleTurnIds}
            previewItem={turnNavigator.previewItem}
            isJumping={turnNavigator.isJumping}
            hasPrevious={turnNavigator.hasPrevious}
            hasNext={turnNavigator.hasNext}
            onPreviewTurnChange={turnNavigator.setPreviewTurnId}
            onJumpTurn={(item, options) => {
              void turnNavigator.jumpToTurn(item, options);
            }}
            onPrevious={turnNavigator.jumpPrevious}
            onNext={turnNavigator.jumpNext}
            onOrigin={(options) => {
              void turnNavigator.jumpOrigin(options);
            }}
            onTerminus={(options) => {
              void turnNavigator.jumpTerminus(options);
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
