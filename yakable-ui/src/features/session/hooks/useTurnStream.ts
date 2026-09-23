import { useCallback, useEffect, useRef, useState } from 'react';

import {
  SessionService,
  type SessionChanges,
  type SessionModel,
  type SessionTurn,
  type TurnStartResult,
} from '@/service/session';

const SESSION_POLL_INTERVAL_MS = 1000;
const ACTIVE_TURN_REWATCH_DELAY_MS = 1000;

interface StartStreamingTurnOptions {
  content: string;
  model: SessionModel;
  requestId: string;
  afterSequence: number;
  onStarted: (started: TurnStartResult) => void;
  onRejected: () => void;
}

interface UseTurnStreamOptions {
  projectId: string;
  sessionId: string;
  activeTurn: boolean;
  activeTurnId: string | null;
  latestSequence: number;
  applyChanges: (changes: SessionChanges) => void;
  onLoadError: (message: string | null) => void;
  onSendError: (message: string | null) => void;
}

export function useTurnStream({
  projectId,
  sessionId,
  activeTurn,
  activeTurnId,
  latestSequence,
  applyChanges,
  onLoadError,
  onSendError,
}: UseTurnStreamOptions) {
  const [streamingTurnId, setStreamingTurnId] = useState<string | null>(null);
  const [watchedTurnId, setWatchedTurnId] = useState<string | null>(null);
  const [watchRetryVersion, setWatchRetryVersion] = useState(0);
  const [streamingContent, setStreamingContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);
  const currentTurnIdRef = useRef<string | null>(null);
  const watchedTurnIdsRef = useRef(new Set<string>());
  const stopRequestedRef = useRef(false);
  const latestSequenceRef = useRef(0);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

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
          applyChanges(changes);
          setStreamingContent('');
          onLoadError(null);
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
          onLoadError(null);

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
  }, [
    activeTurnId,
    applyChanges,
    onLoadError,
    projectId,
    sessionId,
    watchRetryVersion,
  ]);

  useEffect(() => {
    if (!activeTurn || streamingTurnId || watchedTurnId) return;

    let disposed = false;

    const timer = window.setInterval(() => {
      void SessionService.queryChanges(projectId, sessionId, latestSequence)
        .then((changes) => {
          if (disposed) return;
          applyChanges(changes);
          onLoadError(null);
        })
        .catch((requestError: unknown) => {
          if (disposed) return;
          onLoadError(
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
    onLoadError,
    projectId,
    sessionId,
    streamingTurnId,
    watchedTurnId,
  ]);

  const startStreamingTurn = useCallback(
    ({
      content,
      model,
      requestId,
      afterSequence,
      onStarted,
      onRejected,
    }: StartStreamingTurnOptions) => {
      const controller = new AbortController();
      streamAbortRef.current = controller;
      currentTurnIdRef.current = null;
      stopRequestedRef.current = false;
      setIsGenerating(true);
      onSendError(null);
      setStreamingContent('');

      return new Promise<boolean>((resolve) => {
        let established = false;
        let settled = false;
        const settle = (accepted: boolean) => {
          if (settled) return;
          settled = true;
          resolve(accepted);
        };

        void SessionService.streamingTurn(
          projectId,
          sessionId,
          content,
          model,
          requestId,
          {
            onStarted: (started) => {
              established = true;
              currentTurnIdRef.current = started.turn.id;
              setStreamingTurnId(started.turn.id);
              settle(true);
              onStarted(started);
            },
            onSnapshot: (snapshot) => {
              setStreamingContent(snapshot);
            },
            onDelta: (delta) => {
              setStreamingContent((current) => current + delta);
            },
          },
          controller.signal,
        )
          .then(async () => {
            const changes = await SessionService.queryChanges(
              projectId,
              sessionId,
              afterSequence,
            );
            applyChanges(changes);
          })
          .catch(async (requestError) => {
            if (controller.signal.aborted && stopRequestedRef.current) return;

            try {
              const changes = await SessionService.queryChanges(
                projectId,
                sessionId,
                afterSequence,
              );
              applyChanges(changes);
            } catch {
              // 保留原始流式错误。
            }

            if (!established) {
              onSendError(
                requestError instanceof Error ? requestError.message : 'Unable to stream turn.',
              );
            }
          })
          .finally(() => {
            if (!established) {
              onRejected();
              settle(false);
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
          });
      });
    },
    [applyChanges, onSendError, projectId, sessionId],
  );

  const stopStreamingTurn = useCallback(
    (
      fallbackTurnId: string | null,
      onStopped: (turn: SessionTurn) => void,
      onMissingTurn: () => void,
    ) => {
      const turnId = currentTurnIdRef.current ?? fallbackTurnId;
      stopRequestedRef.current = true;
      streamAbortRef.current?.abort();

      if (!turnId) {
        onMissingTurn();
        setIsGenerating(false);
        return;
      }

      void SessionService.stopTurn(projectId, sessionId, turnId)
        .then(async (stopped) => {
          onStopped(stopped);
          onSendError(null);

          try {
            const changes = await SessionService.queryChanges(
              projectId,
              sessionId,
              latestSequence,
            );
            applyChanges(changes);
            setStreamingTurnId(null);
            setStreamingContent('');
          } catch {
            // 保留当前已生成内容，刷新页面后会从后端恢复。
          }
        })
        .catch((requestError: unknown) => {
          onSendError(
            requestError instanceof Error ? requestError.message : 'Unable to stop generation.',
          );
        })
        .finally(() => {
          setIsGenerating(false);
        });
    },
    [applyChanges, latestSequence, onSendError, projectId, sessionId],
  );

  return {
    streamingContent,
    visibleStreamingTurnId: streamingTurnId ?? watchedTurnId,
    generating: isGenerating || activeTurn,
    startStreamingTurn,
    stopStreamingTurn,
  };
}
