import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import {
  SessionService,
  type SessionMessageWindow,
  type SessionTurnNavigationItem,
} from '@/service/session';

import {
  currentTurnAtReadingAnchor,
  findTurnElement,
  hasLoadedTurnStart,
  measureTurnLayout,
  targetScrollTop,
  type TurnJumpOptions,
  visibleTurnIds,
} from './turn-navigation';

const TURN_ANCHOR_WAIT_FRAMES = 8;

interface ActiveJump {
  id: number;
  controller: AbortController;
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

interface UseTurnNavigatorOptions {
  projectId: string;
  sessionId: string;
  scrollRef: RefObject<HTMLDivElement>;
  renderedTurnIds: string[];
  navigationRefreshKey: number;
  replaceWindow: (window: SessionMessageWindow) => void;
  restoreLatestWindow: (signal?: AbortSignal) => Promise<boolean>;
  onFollowLatestChange: (followLatest: boolean) => void;
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

async function waitForTurnAnchor(
  container: HTMLElement,
  turnId: string,
  signal: AbortSignal,
  requireTurnStart = true,
) {
  for (let attempt = 0; attempt < TURN_ANCHOR_WAIT_FRAMES; attempt += 1) {
    if (signal.aborted) return null;

    const anchor = findTurnElement(container, turnId);
    if (anchor && (!requireTurnStart || hasLoadedTurnStart(anchor))) return anchor;
    await nextFrame();
  }
  return null;
}

export function useTurnNavigator({
  projectId,
  sessionId,
  scrollRef,
  renderedTurnIds,
  navigationRefreshKey,
  replaceWindow,
  restoreLatestWindow,
  onFollowLatestChange,
}: UseTurnNavigatorOptions) {
  const [items, setItems] = useState<SessionTurnNavigationItem[]>([]);
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [previewTurnId, setPreviewTurnId] = useState<string | null>(null);
  const [isJumping, setIsJumping] = useState(false);
  const frameRef = useRef<number | null>(null);
  const jumpSequenceRef = useRef(0);
  const activeJumpRef = useRef<ActiveJump | null>(null);
  const renderedTurnKey = renderedTurnIds.join('|');

  useEffect(() => {
    const controller = new AbortController();

    void SessionService.queryTurnNavigation(projectId, sessionId, controller.signal)
      .then((navigation) => {
        if (!controller.signal.aborted) setItems(navigation);
      })
      .catch(() => {
        if (!controller.signal.aborted) setItems([]);
      });

    return () => {
      controller.abort();
    };
  }, [navigationRefreshKey, projectId, sessionId]);

  const measure = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const layout = measureTurnLayout(container);
    const nextCurrent = currentTurnAtReadingAnchor(
      layout,
      container.scrollTop,
      container.clientHeight,
    );
    const nextVisible = visibleTurnIds(layout, container.scrollTop, container.clientHeight);

    setCurrentTurnId(nextCurrent);
    setVisibleIds((current) => (sameIds(current, nextVisible) ? current : nextVisible));
  }, [scrollRef]);

  const scheduleMeasure = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      measure();
    });
  }, [measure]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            scheduleMeasure();
          });

    container.addEventListener('scroll', scheduleMeasure, { passive: true });
    window.addEventListener('resize', scheduleMeasure);
    container
      .querySelectorAll<HTMLElement>('[data-turn-id]')
      .forEach((element) => resizeObserver?.observe(element));

    scheduleMeasure();

    return () => {
      container.removeEventListener('scroll', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
      resizeObserver?.disconnect();

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [renderedTurnKey, scheduleMeasure, scrollRef]);

  const beginJump = useCallback(() => {
    activeJumpRef.current?.controller.abort();

    const jump: ActiveJump = {
      id: ++jumpSequenceRef.current,
      controller: new AbortController(),
    };
    activeJumpRef.current = jump;
    setIsJumping(true);
    return jump;
  }, []);

  const isActiveJump = useCallback((jump: ActiveJump) => {
    return activeJumpRef.current?.id === jump.id && !jump.controller.signal.aborted;
  }, []);

  const finishJump = useCallback((jump: ActiveJump) => {
    if (activeJumpRef.current?.id !== jump.id) return;

    activeJumpRef.current = null;
    setIsJumping(false);
  }, []);

  const cancelJump = useCallback(() => {
    activeJumpRef.current?.controller.abort();
    activeJumpRef.current = null;
    setIsJumping(false);
  }, []);

  useEffect(
    () => () => {
      activeJumpRef.current?.controller.abort();
      activeJumpRef.current = null;
    },
    [],
  );

  const ensureTurnRendered = useCallback(
    async (item: SessionTurnNavigationItem, jump: ActiveJump) => {
      const container = scrollRef.current;
      if (!container || !isActiveJump(jump)) return null;

      const existing = findTurnElement(container, item.turnId);
      if (existing && hasLoadedTurnStart(existing)) return existing;

      const windowResult = await SessionService.queryMessageWindow(
        projectId,
        sessionId,
        item.userMessageSequence,
        jump.controller.signal,
      );
      if (!isActiveJump(jump)) return null;

      replaceWindow(windowResult);
      return waitForTurnAnchor(container, item.turnId, jump.controller.signal);
    },
    [isActiveJump, projectId, replaceWindow, scrollRef, sessionId],
  );

  const alignTurn = useCallback(
    (
      container: HTMLElement,
      item: SessionTurnNavigationItem,
      anchor: HTMLElement,
      options: TurnJumpOptions,
      jump: ActiveJump,
    ) => {
      if (!isActiveJump(jump)) return;

      const layout = measureTurnLayout(container);
      const entry = layout.find((candidate) => candidate.turnId === item.turnId);
      if (!entry) return;

      container.scrollTop = targetScrollTop(
        entry,
        container.clientHeight,
        container.scrollHeight,
      );
      scheduleMeasure();

      if (options.focusTarget) {
        anchor.focus({ preventScroll: true });
      }
    },
    [isActiveJump, scheduleMeasure],
  );

  const jumpToTurn = useCallback(
    async (item: SessionTurnNavigationItem, options: TurnJumpOptions = {}) => {
      const container = scrollRef.current;
      if (!container) return;

      const jump = beginJump();
      onFollowLatestChange(false);

      try {
        const anchor = await ensureTurnRendered(item, jump);
        if (!anchor) return;

        alignTurn(container, item, anchor, options, jump);
      } catch {
        // A superseded or failed navigation keeps the last committed Message Window.
      } finally {
        finishJump(jump);
      }
    },
    [
      alignTurn,
      beginJump,
      ensureTurnRendered,
      finishJump,
      onFollowLatestChange,
      scrollRef,
    ],
  );

  const currentIndex = items.findIndex((item) => item.turnId === currentTurnId);
  const previousItem = currentIndex > 0 ? items[currentIndex - 1] : null;
  const nextItem =
    currentIndex >= 0 && currentIndex < items.length - 1 ? items[currentIndex + 1] : null;

  const jumpPrevious = useCallback(
    (options: TurnJumpOptions = {}) => {
      if (previousItem) void jumpToTurn(previousItem, options);
    },
    [jumpToTurn, previousItem],
  );

  const jumpNext = useCallback(
    (options: TurnJumpOptions = {}) => {
      if (nextItem) void jumpToTurn(nextItem, options);
    },
    [jumpToTurn, nextItem],
  );

  const jumpOrigin = useCallback(
    async (options: TurnJumpOptions = {}) => {
      const container = scrollRef.current;
      const first = items[0];
      if (!container || !first) return;

      const jump = beginJump();
      onFollowLatestChange(false);

      try {
        const anchor = await ensureTurnRendered(first, jump);
        if (!anchor || !isActiveJump(jump)) return;

        container.scrollTop = 0;
        scheduleMeasure();
        if (options.focusTarget) {
          anchor.focus({ preventScroll: true });
        }
      } catch {
        // A superseded or failed origin navigation keeps the committed window.
      } finally {
        finishJump(jump);
      }
    },
    [
      beginJump,
      ensureTurnRendered,
      finishJump,
      isActiveJump,
      items,
      onFollowLatestChange,
      scheduleMeasure,
      scrollRef,
    ],
  );

  const jumpTerminus = useCallback(
    async (options: TurnJumpOptions = {}) => {
      const container = scrollRef.current;
      const last = items.at(-1);
      if (!container || !last) return;

      const jump = beginJump();

      try {
        const restored = await restoreLatestWindow(jump.controller.signal);
        if (!restored || !isActiveJump(jump)) return;

        const anchor = await waitForTurnAnchor(
          container,
          last.turnId,
          jump.controller.signal,
          false,
        );
        if (!isActiveJump(jump)) return;

        onFollowLatestChange(true);
        container.scrollTop = container.scrollHeight;
        scheduleMeasure();

        if (anchor && options.focusTarget) {
          anchor.focus({ preventScroll: true });
        }
      } catch {
        // A superseded or failed latest navigation keeps the committed window.
      } finally {
        finishJump(jump);
      }
    },
    [
      beginJump,
      finishJump,
      isActiveJump,
      items,
      onFollowLatestChange,
      restoreLatestWindow,
      scheduleMeasure,
      scrollRef,
    ],
  );

  const previewItem = useMemo(
    () => items.find((item) => item.turnId === previewTurnId) ?? null,
    [items, previewTurnId],
  );

  return {
    items,
    currentTurnId,
    visibleTurnIds: visibleIds,
    previewItem,
    isJumping,
    hasPrevious: previousItem !== null,
    hasNext: nextItem !== null,
    setPreviewTurnId,
    jumpToTurn,
    jumpPrevious,
    jumpNext,
    jumpOrigin,
    jumpTerminus,
    cancelJump,
  };
}
