import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ModelSelector, type ModelSelection } from '@/features/model';
import { ProjectHeader } from '@/features/project';
import {
  SessionService,
  type SessionChanges,
  type SessionMessage,
  type SessionSnapshot,
} from '@/service/session';
import { cx, Icon, IconButton, PromptComposer, PromptComposerSkeleton } from '@/shared/ui';

import { MessageItem } from './MessageItem';

const SESSION_POLL_INTERVAL_MS = 1000;
const ACTIVE_TURN_REWATCH_DELAY_MS = 1000;
const SCROLL_BOTTOM_THRESHOLD_PX = 120;
const HISTORY_LOAD_THRESHOLD_PX = 80;
const MESSAGE_PAGE_SIZE = 50;

function hasActiveTurn(snapshot: SessionSnapshot | null) {
  return Boolean(
    snapshot?.turns.some((turn) => turn.status === 'PENDING' || turn.status === 'RUNNING'),
  );
}

function latestActiveTurnId(snapshot: SessionSnapshot | null) {
  return (
    snapshot?.turns.filter((turn) => turn.status === 'PENDING' || turn.status === 'RUNNING').at(-1)
      ?.id ?? null
  );
}

function isNearBottom(element: HTMLElement) {
  return (
    element.scrollHeight - element.scrollTop - element.clientHeight <= SCROLL_BOTTOM_THRESHOLD_PX
  );
}

function mergeChanges(snapshot: SessionSnapshot, changes: SessionChanges): SessionSnapshot {
  const hasLatestTurn = snapshot.turns.some((turn) => turn.id === changes.latestTurn.id);

  const turns = hasLatestTurn
    ? snapshot.turns.map((turn) => (turn.id === changes.latestTurn.id ? changes.latestTurn : turn))
    : [...snapshot.turns, changes.latestTurn];

  const existingSequences = new Set(snapshot.messages.map((message) => message.sequence));
  const messages = [
    ...snapshot.messages,
    ...changes.messages.filter((message) => !existingSequences.has(message.sequence)),
  ].sort((left, right) => left.sequence - right.sequence);

  return {
    ...snapshot,
    turns,
    messages,
  };
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
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [streamingTurnId, setStreamingTurnId] = useState<string | null>(null);
  const [watchedTurnId, setWatchedTurnId] = useState<string | null>(null);
  const [watchRetryVersion, setWatchRetryVersion] = useState(0);
  const [streamingContent, setStreamingContent] = useState('');
  const [optimisticMessage, setOptimisticMessage] = useState<SessionMessage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelSelection | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const loadingOlderRef = useRef(false);
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
  const loadedSessionId = snapshot?.session.id ?? null;
  const messageCount = snapshot?.messages.length ?? 0;

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

  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    followOutputRef.current = true;
    setShowScrollBottom(false);
    element.scrollTop = element.scrollHeight;
  }, []);

  const loadOlderMessages = useCallback(async () => {
    const current = snapshot;
    const element = scrollRef.current;
    if (
      !current ||
      !element ||
      !current.hasMoreMessages ||
      current.nextBeforeSequence === null ||
      loadingOlderRef.current
    ) {
      return;
    }

    loadingOlderRef.current = true;
    setIsLoadingOlder(true);
    const previousScrollHeight = element.scrollHeight;

    try {
      const page = await SessionService.queryMessages(
        projectId,
        sessionId,
        current.nextBeforeSequence,
        MESSAGE_PAGE_SIZE,
      );

      setSnapshot((latest) => {
        if (!latest) return latest;

        const existingSequences = new Set(latest.messages.map((message) => message.sequence));
        const older = page.messages.filter((message) => !existingSequences.has(message.sequence));

        return {
          ...latest,
          messages: [...older, ...latest.messages],
          nextBeforeSequence: page.nextBeforeSequence,
          hasMoreMessages: page.hasMore,
        };
      });

      window.requestAnimationFrame(() => {
        const currentElement = scrollRef.current;
        if (!currentElement) return;
        currentElement.scrollTop += currentElement.scrollHeight - previousScrollHeight;
      });
    } catch (requestError) {
      setLoadError(
        requestError instanceof Error ? requestError.message : 'Unable to load earlier messages.',
      );
    } finally {
      loadingOlderRef.current = false;
      setIsLoadingOlder(false);
    }
  }, [projectId, sessionId, snapshot]);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const nearBottom = isNearBottom(element);
    followOutputRef.current = nearBottom;
    setShowScrollBottom(!nearBottom);

    if (element.scrollTop <= HISTORY_LOAD_THRESHOLD_PX) {
      void loadOlderMessages();
    }
  }, [loadOlderMessages]);

  useEffect(() => {
    const controller = new AbortController();

    void SessionService.querySession(projectId, sessionId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setSnapshot(result);
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
  }, [projectId, sessionId]);

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
  }, [loadedSessionId, messageCount, optimisticMessage, scrollToBottom, streamingContent]);

  const activeTurn = hasActiveTurn(snapshot);
  const activeTurnId = latestActiveTurnId(snapshot);
  const generating = isGenerating || activeTurn;
  const latestSequence = snapshot?.messages.at(-1)?.sequence ?? 0;
  const visibleStreamingTurnId = streamingTurnId ?? watchedTurnId;

  useEffect(() => {
    latestSequenceRef.current = latestSequence;
  }, [latestSequence]);

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
          setSnapshot((current) => (current ? mergeChanges(current, changes) : current));
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

          setSnapshot((current) => (current ? mergeChanges(current, changes) : current));
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
  }, [activeTurnId, projectId, sessionId, watchRetryVersion]);

  useEffect(() => {
    if (!activeTurn || streamingTurnId || watchedTurnId) return;

    let disposed = false;

    const timer = window.setInterval(() => {
      void SessionService.queryChanges(projectId, sessionId, latestSequence)
        .then((changes) => {
          if (disposed) return;
          setSnapshot((current) => (current ? mergeChanges(current, changes) : current));
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
  }, [activeTurn, latestSequence, projectId, sessionId, streamingTurnId, watchedTurnId]);

  const latestTurn = useMemo(() => snapshot?.turns.at(-1) ?? null, [snapshot]);

  const streamingMessage: SessionMessage | null =
    visibleStreamingTurnId && streamingContent
      ? {
          id: 'stream-' + visibleStreamingTurnId,
          turnId: visibleStreamingTurnId,
          role: 'ASSISTANT',
          content: streamingContent,
          sequence: Number.MAX_SAFE_INTEGER,
          createdAt: new Date().toISOString(),
        }
      : null;

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
              setOptimisticMessage(null);
              onActivity?.(sessionId, started.userMessage.createdAt);
              setSnapshot((current) => {
                if (!current) return current;
                return {
                  ...current,
                  session: {
                    ...current.session,
                    model,
                  },
                  turns: [...current.turns, started.turn],
                  messages: [...current.messages, started.userMessage],
                };
              });
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
        setSnapshot((current) => (current ? mergeChanges(current, changes) : current));
      } catch (requestError) {
        if (!established) {
          setOptimisticMessage(null);
        }
        if (controller.signal.aborted && stopRequestedRef.current) return;

        try {
          const changes = await SessionService.queryChanges(projectId, sessionId, afterSequence);
          setSnapshot((current) => (current ? mergeChanges(current, changes) : current));
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
    [onActivity, projectId, sessionId],
  );

  const handleSubmit = useCallback(
    (content: string) => {
      if (!selectedModel) return false;

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
      setOptimisticMessage({
        id: 'optimistic-user-' + Date.now(),
        turnId: 'optimistic',
        role: 'USER',
        content,
        sequence: latestSequence + 1,
        createdAt: new Date().toISOString(),
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
    [latestSequence, runStreamingTurn, selectedModel],
  );

  const handleStop = useCallback(() => {
    const turnId = currentTurnIdRef.current ?? activeTurnId;
    stopRequestedRef.current = true;
    streamAbortRef.current?.abort();

    if (!turnId) {
      setOptimisticMessage(null);
      setIsGenerating(false);
      return;
    }

    void SessionService.stopTurn(projectId, sessionId, turnId)
      .then(async (stopped) => {
        setSnapshot((current) => {
          if (!current) return current;
          return {
            ...current,
            turns: current.turns.map((turn) => (turn.id === stopped.id ? stopped : turn)),
          };
        });
        setSendError(null);

        try {
          const changes = await SessionService.queryChanges(projectId, sessionId, latestSequence);
          setSnapshot((current) => (current ? mergeChanges(current, changes) : current));
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
  }, [activeTurnId, latestSequence, projectId, sessionId]);

  return (
    <div
      className={cx(
        'flex min-h-0 flex-col bg-workspace',
        expanded ? 'fixed inset-0 z-50 h-screen' : 'h-full',
      )}
    >
      <ProjectHeader
        title={snapshot?.session.title ?? 'Project'}
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

              {snapshot?.messages.map((message) => (
                <MessageItem key={message.id} message={message} />
              ))}

              {optimisticMessage && (
                <MessageItem key={optimisticMessage.id} message={optimisticMessage} />
              )}

              {streamingMessage && (
                <MessageItem key={streamingMessage.id} message={streamingMessage} />
              )}

              {generating && !streamingContent && (
                <output className="block px-1 text-sm text-foreground-subtle">Thinking...</output>
              )}

              {latestTurn?.status === 'FAILED' && (
                <div
                  className="rounded-xl border border-danger-border-subtle bg-danger-surface px-4 py-3 text-sm text-danger-foreground"
                  role="alert"
                >
                  {latestTurn.errorMessage ?? 'Turn failed.'}
                </div>
              )}
            </div>
          )}
        </div>

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
            onClick={scrollToBottom}
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
              disabled={!snapshot}
              running={generating}
              trailingActions={
                selectedModel ? (
                  <ModelSelector
                    surface="chassis"
                    disabled={!snapshot}
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
