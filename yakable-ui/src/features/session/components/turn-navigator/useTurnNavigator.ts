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
  onFollowLatestChange: (followLatest: boolean) => void;
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

async function waitForTurnAnchor(container: HTMLElement, turnId: string) {
  for (let attempt = 0; attempt < TURN_ANCHOR_WAIT_FRAMES; attempt += 1) {
    const anchor = findTurnElement(container, turnId);
    if (anchor && hasLoadedTurnStart(anchor)) return anchor;
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
  onFollowLatestChange,
}: UseTurnNavigatorOptions) {
  const [items, setItems] = useState<SessionTurnNavigationItem[]>([]);
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [previewTurnId, setPreviewTurnId] = useState<string | null>(null);
  const [isJumping, setIsJumping] = useState(false);
  const frameRef = useRef<number | null>(null);
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

  const ensureTurnRendered = useCallback(
    async (item: SessionTurnNavigationItem) => {
      const container = scrollRef.current;
      if (!container) return null;

      const existing = findTurnElement(container, item.turnId);
      if (existing && hasLoadedTurnStart(existing)) return existing;

      const windowResult = await SessionService.queryMessageWindow(
        projectId,
        sessionId,
        item.userMessageSequence,
      );
      replaceWindow(windowResult);

      return waitForTurnAnchor(container, item.turnId);
    },
    [projectId, replaceWindow, scrollRef, sessionId],
  );

  const jumpToTurn = useCallback(
    async (item: SessionTurnNavigationItem, options: TurnJumpOptions = {}) => {
      const container = scrollRef.current;
      if (!container || isJumping) return;

      setIsJumping(true);
      onFollowLatestChange(false);

      try {
        const anchor = await ensureTurnRendered(item);
        if (!anchor) return;

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
      } catch {
        // Navigation is optional; keep the current Message Window when a target load fails.
      } finally {
        setIsJumping(false);
      }
    },
    [ensureTurnRendered, isJumping, onFollowLatestChange, scheduleMeasure, scrollRef],
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
      if (!container || !first || isJumping) return;

      setIsJumping(true);
      onFollowLatestChange(false);

      try {
        const anchor = await ensureTurnRendered(first);
        container.scrollTop = 0;
        scheduleMeasure();

        if (anchor && options.focusTarget) {
          anchor.focus({ preventScroll: true });
        }
      } catch {
        // Keep the current window when the origin target cannot be loaded.
      } finally {
        setIsJumping(false);
      }
    },
    [ensureTurnRendered, isJumping, items, onFollowLatestChange, scheduleMeasure, scrollRef],
  );

  const jumpTerminus = useCallback(
    async (options: TurnJumpOptions = {}) => {
      const container = scrollRef.current;
      const last = items.at(-1);
      if (!container || !last || isJumping) return;

      setIsJumping(true);

      try {
        const anchor = await ensureTurnRendered(last);
        onFollowLatestChange(true);
        container.scrollTop = container.scrollHeight;
        scheduleMeasure();

        if (anchor && options.focusTarget) {
          anchor.focus({ preventScroll: true });
        }
      } catch {
        // Keep the current window when the latest target cannot be loaded.
      } finally {
        setIsJumping(false);
      }
    },
    [ensureTurnRendered, isJumping, items, onFollowLatestChange, scheduleMeasure, scrollRef],
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
  };
}
