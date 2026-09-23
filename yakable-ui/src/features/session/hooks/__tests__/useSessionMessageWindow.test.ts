import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionService, type SessionMessage, type SessionSnapshot } from '@/service/session';

import { useSessionMessageWindow } from '../useSessionMessageWindow';

function message(sequence: number, role: 'USER' | 'ASSISTANT' = 'USER'): SessionMessage {
  return {
    id: 'message-' + sequence,
    turnId: 'turn-' + Math.ceil(sequence / 2),
    role,
    content: 'message-' + sequence,
    sequence,
    createdAt: '2026-09-22T00:00:00Z',
  };
}

function snapshot(): SessionSnapshot {
  return {
    session: {
      id: 'session-1',
      projectId: 'project-1',
      title: 'CRM',
      model: {
        provider: 'deepseek',
        model: 'deepseek-flash',
      },
      createdAt: '2026-09-22T00:00:00Z',
      updatedAt: '2026-09-22T00:00:00Z',
    },
    turns: [],
    messages: [message(51), message(52, 'ASSISTANT')],
    nextBeforeSequence: 51,
    hasMoreMessages: true,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSessionMessageWindow', () => {
  it('initializes from the latest Session page and prepends older messages', async () => {
    const queryMessages = vi.spyOn(SessionService, 'queryMessages').mockResolvedValue({
      messages: [message(1), message(2, 'ASSISTANT')],
      nextBeforeSequence: null,
      hasMore: false,
    });

    const { result } = renderHook(() => useSessionMessageWindow('project-1', 'session-1'));

    act(() => {
      result.current.initialize(snapshot());
    });

    expect(result.current.messages.map((item) => item.sequence)).toEqual([51, 52]);
    expect(result.current.hasOlder).toBe(true);

    await act(async () => {
      await result.current.loadOlder();
    });

    expect(queryMessages).toHaveBeenCalledWith('project-1', 'session-1', 51, 50);
    expect(result.current.messages.map((item) => item.sequence)).toEqual([1, 2, 51, 52]);
    expect(result.current.hasOlder).toBe(false);
    expect(result.current.olderCursor).toBeNull();
  });

  it('replaces a target window and appends only genuinely newer messages', async () => {
    const queryMessageWindow = vi.spyOn(SessionService, 'queryMessageWindow').mockResolvedValue({
      messages: [message(100), message(101), message(102), message(103)],
      hasOlder: true,
      hasNewer: false,
      olderCursor: 100,
      newerCursor: null,
    });

    const { result } = renderHook(() => useSessionMessageWindow('project-1', 'session-1'));

    act(() => {
      result.current.replaceWindow({
        messages: [message(100), message(101)],
        hasOlder: true,
        hasNewer: true,
        olderCursor: 100,
        newerCursor: 101,
      });
    });

    await act(async () => {
      await result.current.loadNewer();
    });

    expect(queryMessageWindow).toHaveBeenCalledWith('project-1', 'session-1', 101);
    expect(result.current.messages.map((item) => item.sequence)).toEqual([100, 101, 102, 103]);
    expect(result.current.hasNewer).toBe(false);
    expect(result.current.newerCursor).toBeNull();
  });

  it('restores the latest page and preserves locally newer persisted messages', async () => {
    const queryMessages = vi.spyOn(SessionService, 'queryMessages').mockResolvedValue({
      messages: [message(150), message(151, 'ASSISTANT')],
      nextBeforeSequence: 150,
      hasMore: true,
    });

    const { result } = renderHook(() => useSessionMessageWindow('project-1', 'session-1'));

    act(() => {
      result.current.replaceWindow({
        messages: [message(50), message(51, 'ASSISTANT')],
        hasOlder: true,
        hasNewer: true,
        olderCursor: 50,
        newerCursor: 51,
      });
      result.current.mergeMessages([message(200)]);
    });

    await act(async () => {
      await result.current.restoreLatest();
    });

    expect(queryMessages).toHaveBeenCalledWith('project-1', 'session-1', undefined, 50, undefined);
    expect(result.current.messages.map((item) => item.sequence)).toEqual([150, 151, 200]);
    expect(result.current.hasNewer).toBe(false);
    expect(result.current.newerCursor).toBeNull();
  });

  it('merges persisted changes by Message sequence without duplicates', () => {
    const { result } = renderHook(() => useSessionMessageWindow('project-1', 'session-1'));

    act(() => {
      result.current.initialize(snapshot());
      result.current.mergeMessages([
        { ...message(52, 'ASSISTANT'), content: 'updated' },
        message(53),
      ]);
    });

    expect(result.current.messages.map((item) => item.sequence)).toEqual([51, 52, 53]);
    expect(result.current.messages.find((item) => item.sequence === 52)?.content).toBe('updated');
  });
});
