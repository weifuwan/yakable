import { useLayoutEffect, useRef } from 'react';

import type { SessionMessage, SessionTurn, TurnStatus } from '@/service/session';

import { MessageItem } from './MessageItem';

export interface OptimisticTurnRenderInput {
  key: string;
  message: SessionMessage;
}

export interface TurnRenderModel {
  key: string;
  turnId: string | null;
  userMessage: SessionMessage | null;
  assistantMessages: SessionMessage[];
  streamingMessage: SessionMessage | null;
  status: TurnStatus | 'OPTIMISTIC' | null;
  isThinking: boolean;
  failureMessage: string | null;
}

interface BuildTurnRenderModelsInput {
  messages: SessionMessage[];
  turns: SessionTurn[];
  optimisticTurn: OptimisticTurnRenderInput | null;
  streamingMessage: SessionMessage | null;
  activeTurnId: string | null;
  latestTurnId: string | null;
  showThinking: boolean;
}

interface TurnItemProps {
  turn: TurnRenderModel;
  mounted?: boolean;
  placeholderHeight?: number | null;
  onMeasure?: (key: string, height: number) => void;
}

function createPersistedModel(turnId: string, turnById: Map<string, SessionTurn>): TurnRenderModel {
  return {
    key: 'turn:' + turnId,
    turnId,
    userMessage: null,
    assistantMessages: [],
    streamingMessage: null,
    status: turnById.get(turnId)?.status ?? null,
    isThinking: false,
    failureMessage: null,
  };
}

export function buildTurnRenderModels({
  messages,
  turns,
  optimisticTurn,
  streamingMessage,
  activeTurnId,
  latestTurnId,
  showThinking,
}: BuildTurnRenderModelsInput): TurnRenderModel[] {
  const turnById = new Map(turns.map((turn) => [turn.id, turn]));
  const models = new Map<string, TurnRenderModel>();

  for (const message of messages) {
    const key = 'turn:' + message.turnId;
    const model = models.get(key) ?? createPersistedModel(message.turnId, turnById);

    if (message.role === 'USER') {
      model.userMessage ??= message;
    } else {
      model.assistantMessages.push(message);
    }
    models.set(key, model);
  }

  if (optimisticTurn) {
    models.set(optimisticTurn.key, {
      key: optimisticTurn.key,
      turnId: null,
      userMessage: optimisticTurn.message,
      assistantMessages: [],
      streamingMessage: null,
      status: 'OPTIMISTIC',
      isThinking: false,
      failureMessage: null,
    });
  }

  if (streamingMessage) {
    const key = 'turn:' + streamingMessage.turnId;
    const model = models.get(key) ?? createPersistedModel(streamingMessage.turnId, turnById);
    model.streamingMessage = streamingMessage;
    models.set(key, model);
  }

  if (showThinking) {
    const thinkingKey = optimisticTurn?.key ?? (activeTurnId ? 'turn:' + activeTurnId : null);
    if (thinkingKey) {
      const model = models.get(thinkingKey);
      if (model) model.isThinking = true;
    }
  }

  if (latestTurnId) {
    const latest = turnById.get(latestTurnId);
    const latestModel = models.get('turn:' + latestTurnId);
    if (latest?.status === 'FAILED' && latestModel) {
      latestModel.failureMessage = latest.errorMessage ?? 'Turn failed.';
    }
  }

  return [...models.values()];
}

export function TurnItem({
  turn,
  mounted = true,
  placeholderHeight = null,
  onMeasure,
}: TurnItemProps) {
  const anchorRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || !mounted || !onMeasure) return;

    const report = () => {
      onMeasure(turn.key, anchor.getBoundingClientRect().height);
    };

    report();

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(report);
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [mounted, onMeasure, turn.key]);

  return (
    <section
      ref={anchorRef}
      data-turn-id={turn.turnId ?? undefined}
      data-turn-key={turn.key}
      data-turn-user-loaded={turn.userMessage ? 'true' : 'false'}
      data-turn-window={mounted ? 'mounted' : 'placeholder'}
      tabIndex={-1}
      style={!mounted && placeholderHeight !== null ? { height: placeholderHeight } : undefined}
      className="flex shrink-0 flex-col gap-6 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring"
    >
      {mounted && (
        <>
          {turn.userMessage && <MessageItem message={turn.userMessage} />}

          {turn.assistantMessages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}

          {turn.streamingMessage && <MessageItem message={turn.streamingMessage} streaming />}

          {turn.isThinking && (
            <output className="block px-1 text-sm text-foreground-subtle">Thinking...</output>
          )}

          {turn.failureMessage && (
            <div
              className="rounded-xl border border-danger-border-subtle bg-danger-surface px-4 py-3 text-sm text-danger-foreground"
              role="alert"
            >
              {turn.failureMessage}
            </div>
          )}
        </>
      )}
    </section>
  );
}
