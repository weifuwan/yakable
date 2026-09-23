import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SessionMessage, SessionTurn } from '@/service/session';

import { buildTurnRenderModels, TurnItem } from '../TurnItem';

const turns: SessionTurn[] = [
  {
    id: 'turn-1',
    status: 'SUCCEEDED',
    attemptCount: 1,
    errorMessage: null,
    invocation: {
      provider: 'deepseek',
      model: 'deepseek-flash',
      usage: null,
      providerRequestId: null,
      finishReason: null,
    },
    startedAt: '2026-09-22T00:00:00Z',
    finishedAt: '2026-09-22T00:00:01Z',
    durationMs: 1000,
    createdAt: '2026-09-22T00:00:00Z',
    updatedAt: '2026-09-22T00:00:01Z',
  },
  {
    id: 'turn-2',
    status: 'RUNNING',
    attemptCount: 1,
    errorMessage: null,
    invocation: {
      provider: 'deepseek',
      model: 'deepseek-flash',
      usage: null,
      providerRequestId: null,
      finishReason: null,
    },
    startedAt: '2026-09-22T00:00:02Z',
    finishedAt: null,
    durationMs: null,
    createdAt: '2026-09-22T00:00:02Z',
    updatedAt: '2026-09-22T00:00:02Z',
  },
];

const messages: SessionMessage[] = [
  {
    id: 'message-1',
    turnId: 'turn-1',
    role: 'USER',
    content: 'First prompt',
    sequence: 1,
    createdAt: '2026-09-22T00:00:00Z',
  },
  {
    id: 'message-2',
    turnId: 'turn-1',
    role: 'ASSISTANT',
    content: 'First answer',
    sequence: 2,
    createdAt: '2026-09-22T00:00:01Z',
  },
  {
    id: 'message-3',
    turnId: 'turn-2',
    role: 'USER',
    content: 'Second prompt',
    sequence: 3,
    createdAt: '2026-09-22T00:00:02Z',
  },
];

describe('TurnItem', () => {
  it('groups persisted and streaming messages by Turn identity', () => {
    const streamingMessage: SessionMessage = {
      id: 'stream-turn-2',
      turnId: 'turn-2',
      role: 'ASSISTANT',
      content: 'Streaming answer',
      sequence: Number.MAX_SAFE_INTEGER,
      createdAt: '2026-09-22T00:00:03Z',
    };

    const result = buildTurnRenderModels({
      messages,
      turns,
      optimisticTurn: null,
      streamingMessage,
      activeTurnId: 'turn-2',
      latestTurnId: 'turn-2',
      showThinking: false,
    });

    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('turn:turn-1');
    expect(result[0].userMessage?.id).toBe('message-1');
    expect(result[0].assistantMessages.map((message) => message.id)).toEqual(['message-2']);
    expect(result[1].userMessage?.id).toBe('message-3');
    expect(result[1].streamingMessage?.id).toBe('stream-turn-2');
    expect(result[1].status).toBe('RUNNING');
  });

  it('keeps an optimistic prompt as its own stable Turn boundary', () => {
    const optimisticMessage: SessionMessage = {
      id: 'optimistic-user-request-1',
      turnId: 'optimistic',
      role: 'USER',
      content: 'Pending prompt',
      sequence: 4,
      createdAt: '2026-09-22T00:00:04Z',
    };

    const result = buildTurnRenderModels({
      messages,
      turns,
      optimisticTurn: {
        key: 'optimistic:request-1',
        message: optimisticMessage,
      },
      streamingMessage: null,
      activeTurnId: null,
      latestTurnId: 'turn-2',
      showThinking: true,
    });

    expect(result.at(-1)).toMatchObject({
      key: 'optimistic:request-1',
      turnId: null,
      status: 'OPTIMISTIC',
      isThinking: true,
    });
    expect(result.at(-1)?.userMessage).toBe(optimisticMessage);
  });

  it('renders one focusable anchor around the whole Turn', () => {
    const [turn] = buildTurnRenderModels({
      messages: messages.slice(0, 2),
      turns: turns.slice(0, 1),
      optimisticTurn: null,
      streamingMessage: null,
      activeTurnId: null,
      latestTurnId: 'turn-1',
      showThinking: false,
    });

    const { container } = render(<TurnItem turn={turn} />);

    const anchor = container.querySelector('[data-turn-id="turn-1"]');
    expect(anchor).toBeTruthy();
    expect(anchor?.getAttribute('data-turn-key')).toBe('turn:turn-1');
    expect(anchor?.getAttribute('data-turn-user-loaded')).toBe('true');
    expect((anchor as HTMLElement).tabIndex).toBe(-1);
    expect(anchor?.contains(screen.getByText('First prompt'))).toBe(true);
    expect(anchor?.contains(screen.getByText('First answer'))).toBe(true);
  });
});
