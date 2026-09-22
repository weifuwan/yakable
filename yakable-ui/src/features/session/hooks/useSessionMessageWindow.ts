import { useCallback, useRef, useState } from 'react';

import {
  SessionService,
  type SessionMessage,
  type SessionMessageWindow,
  type SessionSnapshot,
} from '@/service/session';

const MESSAGE_PAGE_SIZE = 50;

interface MessageWindowState {
  messages: SessionMessage[];
  olderCursor: number | null;
  newerCursor: number | null;
  hasOlder: boolean;
  hasNewer: boolean;
}

const EMPTY_WINDOW: MessageWindowState = {
  messages: [],
  olderCursor: null,
  newerCursor: null,
  hasOlder: false,
  hasNewer: false,
};

function mergeMessages(current: SessionMessage[], incoming: SessionMessage[]) {
  const bySequence = new Map<number, SessionMessage>();

  current.forEach((message) => bySequence.set(message.sequence, message));
  incoming.forEach((message) => bySequence.set(message.sequence, message));

  return [...bySequence.values()].sort((left, right) => left.sequence - right.sequence);
}

export function useSessionMessageWindow(projectId: string, sessionId: string) {
  const [windowState, setWindowState] = useState<MessageWindowState>(EMPTY_WINDOW);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isLoadingNewer, setIsLoadingNewer] = useState(false);
  const loadingOlderRef = useRef(false);
  const loadingNewerRef = useRef(false);

  const initialize = useCallback((snapshot: SessionSnapshot) => {
    setWindowState({
      messages: snapshot.messages,
      olderCursor: snapshot.nextBeforeSequence,
      newerCursor: null,
      hasOlder: snapshot.hasMoreMessages,
      hasNewer: false,
    });
  }, []);

  const replaceWindow = useCallback((window: SessionMessageWindow) => {
    setWindowState({
      messages: window.messages,
      olderCursor: window.olderCursor,
      newerCursor: window.newerCursor,
      hasOlder: window.hasOlder,
      hasNewer: window.hasNewer,
    });
  }, []);

  const merge = useCallback((messages: SessionMessage[]) => {
    if (messages.length === 0) return;

    setWindowState((current) => ({
      ...current,
      messages: mergeMessages(current.messages, messages),
    }));
  }, []);

  const loadOlder = useCallback(async () => {
    if (
      loadingOlderRef.current ||
      !windowState.hasOlder ||
      windowState.olderCursor === null
    ) {
      return false;
    }

    loadingOlderRef.current = true;
    setIsLoadingOlder(true);

    try {
      const page = await SessionService.queryMessages(
        projectId,
        sessionId,
        windowState.olderCursor,
        MESSAGE_PAGE_SIZE,
      );

      setWindowState((current) => ({
        ...current,
        messages: mergeMessages(page.messages, current.messages),
        olderCursor: page.nextBeforeSequence,
        hasOlder: page.hasMore,
      }));
      return true;
    } finally {
      loadingOlderRef.current = false;
      setIsLoadingOlder(false);
    }
  }, [projectId, sessionId, windowState.hasOlder, windowState.olderCursor]);

  const loadNewer = useCallback(async () => {
    if (
      loadingNewerRef.current ||
      !windowState.hasNewer ||
      windowState.newerCursor === null
    ) {
      return false;
    }

    loadingNewerRef.current = true;
    setIsLoadingNewer(true);

    try {
      const currentLastSequence = windowState.messages.at(-1)?.sequence ?? 0;
      const next = await SessionService.queryMessageWindow(
        projectId,
        sessionId,
        windowState.newerCursor,
      );

      setWindowState((current) => ({
        ...current,
        messages: mergeMessages(
          current.messages,
          next.messages.filter((message) => message.sequence > currentLastSequence),
        ),
        newerCursor: next.newerCursor,
        hasNewer: next.hasNewer,
      }));
      return true;
    } finally {
      loadingNewerRef.current = false;
      setIsLoadingNewer(false);
    }
  }, [
    projectId,
    sessionId,
    windowState.hasNewer,
    windowState.messages,
    windowState.newerCursor,
  ]);

  return {
    ...windowState,
    isLoadingOlder,
    isLoadingNewer,
    initialize,
    replaceWindow,
    mergeMessages: merge,
    loadOlder,
    loadNewer,
  };
}
