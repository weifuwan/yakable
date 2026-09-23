import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react';

import type { SessionTurnNavigationItem } from '@/service/session';

import type { TurnJumpOptions } from './turn-navigation';

const CLOSE_GRACE_MS = 140;

interface UseTurnNavigatorInteractionOptions {
  items: SessionTurnNavigationItem[];
  currentTurnId: string | null;
  onJumpTurn: (item: SessionTurnNavigationItem, options?: TurnJumpOptions) => void;
}

export function useTurnNavigatorInteraction({
  items,
  currentTurnId,
  onJumpTurn,
}: UseTurnNavigatorInteractionOptions) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLButtonElement>(null);
  const overviewRef = useRef<HTMLElement>(null);
  const pointerInsideRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const pendingFocusTurnIdRef = useRef<string | null>(null);
  const suppressNextRailFocusOpenRef = useRef(false);
  const userInteractingRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [rovingTurnId, setRovingTurnId] = useState<string | null>(currentTurnId);

  const resolveCurrentTurnId = useCallback(() => {
    if (currentTurnId && items.some((item) => item.turnId === currentTurnId)) {
      return currentTurnId;
    }
    return items[0]?.turnId ?? null;
  }, [currentTurnId, items]);

  const findPromptRow = useCallback((turnId: string) => {
    return (
      Array.from(
        overviewRef.current?.querySelectorAll<HTMLButtonElement>('[data-nav-turn-id]') ?? [],
      ).find((element) => element.dataset.navTurnId === turnId) ?? null
    );
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current === null) return;

    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const openOverview = useCallback(() => {
    cancelClose();
    setIsOpen((current) => {
      if (!current) {
        userInteractingRef.current = false;
      }
      return true;
    });
  }, [cancelClose]);

  const closeOverview = useCallback(
    (focusRail: boolean) => {
      cancelClose();
      pendingFocusTurnIdRef.current = null;
      userInteractingRef.current = false;
      setRovingTurnId(resolveCurrentTurnId());
      setIsOpen(false);

      if (!focusRail) return;

      suppressNextRailFocusOpenRef.current = true;
      window.requestAnimationFrame(() => {
        railRef.current?.focus();
      });
    },
    [cancelClose, resolveCurrentTurnId],
  );

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      if (pointerInsideRef.current) return;
      if (surfaceRef.current?.contains(document.activeElement)) return;

      pendingFocusTurnIdRef.current = null;
      userInteractingRef.current = false;
      setRovingTurnId(resolveCurrentTurnId());
      setIsOpen(false);
    }, CLOSE_GRACE_MS);
  }, [cancelClose, resolveCurrentTurnId]);

  const focusPromptRow = useCallback(
    (turnId: string) => {
      setRovingTurnId(turnId);

      if (!isOpen) {
        pendingFocusTurnIdRef.current = turnId;
        openOverview();
        return;
      }

      const row = findPromptRow(turnId);
      if (!row) return;

      row.scrollIntoView?.({ block: 'nearest' });
      row.focus();
    },
    [findPromptRow, isOpen, openOverview],
  );

  useEffect(() => {
    if (surfaceRef.current?.contains(document.activeElement)) return;
    setRovingTurnId(resolveCurrentTurnId());
  }, [resolveCurrentTurnId]);

  useEffect(() => {
    if (!isOpen) return;

    const pendingTurnId = pendingFocusTurnIdRef.current;
    if (!pendingTurnId) return;

    const frame = window.requestAnimationFrame(() => {
      const row = findPromptRow(pendingTurnId);
      if (!row) return;

      pendingFocusTurnIdRef.current = null;
      row.scrollIntoView?.({ block: 'nearest' });
      row.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [findPromptRow, isOpen]);

  useEffect(() => {
    if (!isOpen || userInteractingRef.current) return;

    const targetTurnId = resolveCurrentTurnId();
    if (!targetTurnId) return;

    const frame = window.requestAnimationFrame(() => {
      findPromptRow(targetTurnId)?.scrollIntoView?.({ block: 'nearest' });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [findPromptRow, isOpen, resolveCurrentTurnId]);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if (items.length < 3 || !event.altKey || !event.shiftKey || event.key.toLowerCase() !== 'm') {
        return;
      }

      if (
        typeof window.matchMedia === 'function' &&
        !window.matchMedia('(min-width: 768px)').matches
      ) {
        return;
      }

      const targetTurnId = resolveCurrentTurnId();
      if (!targetTurnId) return;

      event.preventDefault();
      focusPromptRow(targetTurnId);
    };

    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [focusPromptRow, items.length, resolveCurrentTurnId]);

  useEffect(
    () => () => {
      cancelClose();
    },
    [cancelClose],
  );

  const onSurfaceFocusCapture = useCallback(() => {
    cancelClose();
  }, [cancelClose]);

  const onSurfaceBlurCapture = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      const next = event.relatedTarget;
      if (next instanceof Node && event.currentTarget.contains(next)) return;

      scheduleClose();
    },
    [scheduleClose],
  );

  const onSurfacePointerMoveCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-nav-turn-id]')) {
      userInteractingRef.current = true;
    }
  }, []);

  const onSurfacePointerDownCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-nav-turn-id]')) {
      userInteractingRef.current = true;
    }
  }, []);

  const onSurfaceWheelCapture = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (event.target instanceof Node && overviewRef.current?.contains(event.target)) {
      userInteractingRef.current = true;
    }
  }, []);

  const onPointerEnter = useCallback(() => {
    pointerInsideRef.current = true;
    cancelClose();
    openOverview();
  }, [cancelClose, openOverview]);

  const onPointerLeave = useCallback(() => {
    pointerInsideRef.current = false;
    scheduleClose();
  }, [scheduleClose]);

  const onRailFocus = useCallback(() => {
    cancelClose();

    if (suppressNextRailFocusOpenRef.current) {
      suppressNextRailFocusOpenRef.current = false;
      return;
    }

    openOverview();
  }, [cancelClose, openOverview]);

  const onRailClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      openOverview();

      if (event.detail === 0) {
        const targetTurnId = resolveCurrentTurnId();
        if (targetTurnId) {
          focusPromptRow(targetTurnId);
        }
      }
    },
    [focusPromptRow, openOverview, resolveCurrentTurnId],
  );

  const onRailKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Escape') {
        if (isOpen) {
          event.preventDefault();
          closeOverview(true);
        }
        return;
      }

      if (event.key !== 'ArrowDown' && event.key !== 'Enter' && event.key !== ' ') return;

      const targetTurnId = resolveCurrentTurnId();
      if (!targetTurnId) return;

      event.preventDefault();
      focusPromptRow(targetTurnId);
    },
    [closeOverview, focusPromptRow, isOpen, resolveCurrentTurnId],
  );

  const onRowFocus = useCallback((item: SessionTurnNavigationItem) => {
    userInteractingRef.current = true;
    setRovingTurnId(item.turnId);
  }, []);

  const onRowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number, item: SessionTurnNavigationItem) => {
      userInteractingRef.current = true;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeOverview(true);
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onJumpTurn(item, { focusTarget: true });
        return;
      }

      let nextIndex: number | null = null;

      if (event.key === 'ArrowUp') {
        nextIndex = Math.max(0, index - 1);
      } else if (event.key === 'ArrowDown') {
        nextIndex = Math.min(items.length - 1, index + 1);
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = items.length - 1;
      }

      if (nextIndex === null) return;

      event.preventDefault();
      const next = items[nextIndex];
      if (next) {
        focusPromptRow(next.turnId);
      }
    },
    [closeOverview, focusPromptRow, items, onJumpTurn],
  );

  const onRowClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, item: SessionTurnNavigationItem) => {
      onJumpTurn(item, { focusTarget: event.detail === 0 });
    },
    [onJumpTurn],
  );

  return {
    surfaceRef,
    railRef,
    overviewRef,
    isOpen,
    rovingTurnId,
    onSurfaceFocusCapture,
    onSurfaceBlurCapture,
    onSurfacePointerMoveCapture,
    onSurfacePointerDownCapture,
    onSurfaceWheelCapture,
    onPointerEnter,
    onPointerLeave,
    onRailFocus,
    onRailClick,
    onRailKeyDown,
    onRowFocus,
    onRowKeyDown,
    onRowClick,
  };
}
