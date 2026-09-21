import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ModelSelector, type ModelSelection } from '@/features/model';
import { ProjectHeader } from '@/features/project';
import {
  SessionService,
  type SessionChanges,
  type SessionMessage,
  type SessionSnapshot,
} from '@/service/session';
import {
  cx,
  Icon,
  IconButton,
  PromptComposer,
  PromptComposerSkeleton,
} from '@/shared/ui';

import { MessageItem } from './MessageItem';

const SESSION_POLL_INTERVAL_MS = 1000;
const SCROLL_BOTTOM_THRESHOLD_PX = 120;

function hasActiveTurn(snapshot: SessionSnapshot | null) {
  return Boolean(
    snapshot?.turns.some(
      (turn) => turn.status === 'PENDING' || turn.status === 'RUNNING',
    ),
  );
}

function latestActiveTurnId(snapshot: SessionSnapshot | null) {
  return (
    snapshot?.turns
      .filter((turn) => turn.status === 'PENDING' || turn.status === 'RUNNING')
      .at(-1)?.id ?? null
  );
}

function isNearBottom(element: HTMLElement) {
  return (
    element.scrollHeight - element.scrollTop - element.clientHeight <=
    SCROLL_BOTTOM_THRESHOLD_PX
  );
}

function mergeChanges(
  snapshot: SessionSnapshot,
  changes: SessionChanges,
): SessionSnapshot {
  const hasLatestTurn = snapshot.turns.some(
    (turn) => turn.id === changes.latestTurn.id,
  );

  const turns = hasLatestTurn
    ? snapshot.turns.map((turn) =>
        turn.id === changes.latestTurn.id ? changes.latestTurn : turn,
      )
    : [...snapshot.turns, changes.latestTurn];

  const existingSequences = new Set(
    snapshot.messages.map((message) => message.sequence),
  );
  const messages = [
    ...snapshot.messages,
    ...changes.messages.filter(
      (message) => !existingSequences.has(message.sequence),
    ),
  ].sort((left, right) => left.sequence - right.sequence);

  return {
    ...snapshot,
    turns,
    messages,
  };
}

function SessionLoadingIndicator() {
  return (
    <div
      className="flex h-full items-center justify-center"
      role="status"
      aria-label="Loading session"
    >
      <svg
        aria-hidden="true"
        className="size-5 animate-spin text-loading"
        viewBox="0 0 24 24"
        fill="none"
      >
        <g
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
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
    </div>
  );
}

export function SessionWorkspace({
  projectId,
  sessionId,
}: {
  projectId: string;
  sessionId: string;
}) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [streamingTurnId, setStreamingTurnId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [optimisticMessage, setOptimisticMessage] =
    useState<SessionMessage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelSelection | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const currentTurnIdRef = useRef<string | null>(null);
  const stopRequestedRef = useRef(false);
  const followOutputRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
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

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const nearBottom = isNearBottom(element);
    followOutputRef.current = nearBottom;
    setShowScrollBottom(!nearBottom);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    initialScrollDoneRef.current = false;
    followOutputRef.current = true;
    setShowScrollBottom(false);
    setSnapshot(null);
    setLoadError(null);
    setSendError(null);
    setOptimisticMessage(null);
    setStreamingTurnId(null);
    setStreamingContent('');
    setIsGenerating(false);
    setSelectedModel(null);
    setIsSessionLoading(true);

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
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load session.',
        );
        setIsSessionLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [projectId, sessionId]);

  useEffect(() => {
    if (!snapshot) return;

    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      scrollToBottom();
      return;
    }

    if (followOutputRef.current) {
      scrollToBottom();
    }
  }, [
    loadedSessionId,
    messageCount,
    optimisticMessage,
    scrollToBottom,
    streamingContent,
  ]);

  const activeTurn = hasActiveTurn(snapshot);
  const activeTurnId = latestActiveTurnId(snapshot);
  const generating = isGenerating || activeTurn;
  const latestSequence = snapshot?.messages.at(-1)?.sequence ?? 0;

  useEffect(() => {
    if (!activeTurn || streamingTurnId) return;

    let disposed = false;

    const timer = window.setInterval(() => {
      void SessionService.queryChanges(
        projectId,
        sessionId,
        latestSequence,
      )
        .then((changes) => {
          if (disposed) return;
          setSnapshot((current) =>
            current ? mergeChanges(current, changes) : current,
          );
          setLoadError(null);
        })
        .catch((requestError: unknown) => {
          if (disposed) return;
          setLoadError(
            requestError instanceof Error
              ? requestError.message
              : 'Unable to refresh session.',
          );
        });
    }, SESSION_POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [activeTurn, latestSequence, projectId, sessionId, streamingTurnId]);

  const latestTurn = useMemo(
    () => snapshot?.turns.at(-1) ?? null,
    [snapshot],
  );

  const streamingMessage: SessionMessage | null =
    streamingTurnId && streamingContent
      ? {
          id: 'stream-' + streamingTurnId,
          turnId: streamingTurnId,
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
      controller: AbortController,
      afterSequence: number,
    ) => {
      try {
        await SessionService.streamingTurn(
          projectId,
          sessionId,
          content,
          model,
          {
            onStarted: (started) => {
              currentTurnIdRef.current = started.turn.id;
              setStreamingTurnId(started.turn.id);
              setOptimisticMessage(null);
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
            onDelta: (delta) => {
              setStreamingContent((current) => current + delta);
            },
          },
          controller.signal,
        );

        const changes = await SessionService.queryChanges(
          projectId,
          sessionId,
          afterSequence,
        );
        setSnapshot((current) =>
          current ? mergeChanges(current, changes) : current,
        );
      } catch (requestError) {
        if (!currentTurnIdRef.current) {
          setOptimisticMessage(null);
        }
        if (controller.signal.aborted && stopRequestedRef.current) return;

        try {
          const changes = await SessionService.queryChanges(
            projectId,
            sessionId,
            afterSequence,
          );
          setSnapshot((current) =>
            current ? mergeChanges(current, changes) : current,
          );
        } catch {
          // 保留原始流式错误。
        }

        setSendError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to stream turn.',
        );
      } finally {
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
    [projectId, sessionId],
  );

  const handleSubmit = useCallback(
    (content: string) => {
      if (!selectedModel) return false;

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

      void runStreamingTurn(content, selectedModel, controller, latestSequence);
      return true;
    },
    [latestSequence, runStreamingTurn, selectedModel],
  );

  const handleRegenerateMessage = useCallback(
    (_message: SessionMessage, content: string) => handleSubmit(content),
    [handleSubmit],
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

    void SessionService.cancelTurn(projectId, sessionId, turnId)
      .then(async (cancelled) => {
        setSnapshot((current) => {
          if (!current) return current;
          return {
            ...current,
            turns: current.turns.map((turn) =>
              turn.id === cancelled.id ? cancelled : turn,
            ),
          };
        });
        setSendError(null);

        try {
          const changes = await SessionService.queryChanges(
            projectId,
            sessionId,
            latestSequence,
          );
          setSnapshot((current) =>
            current ? mergeChanges(current, changes) : current,
          );
          setStreamingTurnId(null);
          setStreamingContent('');
        } catch {
          // 保留当前已生成内容，刷新页面后会从后端恢复。
        }
      })
      .catch((requestError: unknown) => {
        setSendError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to stop generation.',
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

              {snapshot?.messages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  onRegenerate={
                    generating ? undefined : handleRegenerateMessage
                  }
                />
              ))}

              {optimisticMessage && (
                <MessageItem
                  key={optimisticMessage.id}
                  message={optimisticMessage}
                />
              )}

              {streamingMessage && (
                <MessageItem
                  key={streamingMessage.id}
                  message={streamingMessage}
                />
              )}

              {generating && !streamingContent && (
                <p className="m-0 px-1 text-sm text-foreground-subtle" role="status">
                  Thinking...
                </p>
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
              disabled={!snapshot || snapshot.session.status !== 'ACTIVE'}
              running={generating}
              trailingActions={
                selectedModel ? (
                  <ModelSelector
                    surface="chassis"
                    disabled={
                      !snapshot || snapshot.session.status !== 'ACTIVE'
                    }
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
