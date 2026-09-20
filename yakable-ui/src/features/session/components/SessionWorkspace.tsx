import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  SessionService,
  type SessionChanges,
  type SessionMessage,
  type SessionSnapshot,
} from '@/service/session';
import {
  Icon,
  IconButton,
  PromptComposer,
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
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const followOutputRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
  const loadedSessionId = snapshot?.session.id ?? null;
  const messageCount = snapshot?.messages.length ?? 0;

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

    void SessionService.querySession(projectId, sessionId, controller.signal)
      .then((result) => {
        initialScrollDoneRef.current = false;
        followOutputRef.current = true;
        setShowScrollBottom(false);
        setSnapshot(result);
        setLoadError(null);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load session.',
        );
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
  }, [loadedSessionId, messageCount, scrollToBottom, streamingContent]);

  const activeTurn = hasActiveTurn(snapshot);
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

  const handleSubmit = async (content: string) => {
    setSendError(null);
    setStreamingContent('');
    const afterSequence = latestSequence;

    try {
      await SessionService.streamingTurn(projectId, sessionId, content, {
        onStarted: (started) => {
          setStreamingTurnId(started.turn.id);
          setSnapshot((current) => {
            if (!current) return current;
            return {
              ...current,
              turns: [...current.turns, started.turn],
              messages: [...current.messages, started.userMessage],
            };
          });
        },
        onDelta: (delta) => {
          setStreamingContent((current) => current + delta);
        },
      });

      const changes = await SessionService.queryChanges(
        projectId,
        sessionId,
        afterSequence,
      );
      setSnapshot((current) =>
        current ? mergeChanges(current, changes) : current,
      );
      return true;
    } catch (requestError) {
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
      return false;
    } finally {
      setStreamingTurnId(null);
      setStreamingContent('');
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          data-testid="session-message-scroll"
          className="h-full overflow-y-auto"
          onScroll={handleScroll}
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
            {loadError && (
              <div
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                role="alert"
              >
                {loadError}
              </div>
            )}

            {snapshot?.messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}

            {streamingMessage && (
              <MessageItem key={streamingMessage.id} message={streamingMessage} />
            )}

            {activeTurn && !streamingContent && (
              <p className="m-0 px-1 text-sm text-black/40" role="status">
                Yakable is working...
              </p>
            )}

            {latestTurn?.status === 'FAILED' && (
              <div
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {latestTurn.errorMessage ?? 'Turn failed.'}
              </div>
            )}
          </div>
        </div>

        {showScrollBottom && (
          <IconButton
            aria-label="Scroll to bottom"
            variant="secondary"
            size="md"
            className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 hover:cursor-pointer"
            style={{ borderRadius: '50%' }}
            onClick={scrollToBottom}
          >
            <Icon size={18}>
              <path d="M12 5v14" />
              <path d="m6 13 6 6 6-6" />
            </Icon>
          </IconButton>
        )}
      </div>

      <div className="shrink-0 border-t border-black/[0.06] bg-white px-6 py-4">
        <div className="mx-auto w-full max-w-3xl">
          <PromptComposer
            ariaLabel="Send a message"
            placeholder="Ask Yakable..."
            submitLabel="Send message"
            submitTooltip="Send prompt"
            disabled={!snapshot || snapshot.session.status !== 'ACTIVE' || activeTurn}
            onSubmit={handleSubmit}
          />

          {sendError && (
            <p className="mb-0 mt-2 px-2 text-sm text-red-600" role="alert">
              {sendError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
