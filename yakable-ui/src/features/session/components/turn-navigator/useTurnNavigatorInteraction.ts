import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';

import type { SessionTurnNavigationItem } from '@/service/session';

import {
  DRAG_THRESHOLD_PX,
  fisheyeScale,
  hitTestRib,
  measureRibLayout,
  ribContentY,
  type TurnJumpOptions,
} from './turn-navigation';

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
  targetTurnId: string | null;
}

interface UseTurnNavigatorInteractionOptions {
  items: SessionTurnNavigationItem[];
  currentTurnId: string | null;
  onPreviewTurnChange: (turnId: string | null) => void;
  onJumpTurn: (item: SessionTurnNavigationItem, options?: TurnJumpOptions) => void;
}

export function useTurnNavigatorInteraction({
  items,
  currentTurnId,
  onPreviewTurnChange,
  onJumpTurn,
}: UseTurnNavigatorInteractionOptions) {
  const railRef = useRef<HTMLDivElement>(null);
  const pointerInsideRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const lastPointerClientYRef = useRef<number | null>(null);
  const fisheyeFrameRef = useRef<number | null>(null);
  const [interacting, setInteracting] = useState(false);
  const [rovingTurnId, setRovingTurnId] = useState<string | null>(currentTurnId);
  const itemById = useMemo(() => new Map(items.map((item) => [item.turnId, item])), [items]);

  const findRibButton = useCallback((turnId: string) => {
    const rail = railRef.current;
    if (!rail) return null;

    return (
      Array.from(rail.querySelectorAll<HTMLButtonElement>('[data-nav-turn-id]')).find(
        (element) => element.dataset.navTurnId === turnId,
      ) ?? null
    );
  }, []);

  const resetFisheye = useCallback(() => {
    if (fisheyeFrameRef.current !== null) {
      window.cancelAnimationFrame(fisheyeFrameRef.current);
      fisheyeFrameRef.current = null;
    }

    railRef.current?.querySelectorAll<HTMLElement>('[data-rib-visual]').forEach((element) => {
      element.style.transform = 'scaleX(1)';
    });
  }, []);

  const applyFisheye = useCallback((clientY: number) => {
    const rail = railRef.current;
    if (!rail) return;

    if (fisheyeFrameRef.current !== null) {
      window.cancelAnimationFrame(fisheyeFrameRef.current);
    }

    fisheyeFrameRef.current = window.requestAnimationFrame(() => {
      fisheyeFrameRef.current = null;

      const currentRail = railRef.current;
      if (!currentRail) return;

      const layout = measureRibLayout(currentRail);
      const pointerY = ribContentY(currentRail, clientY);

      layout.forEach((entry) => {
        const visual = entry.element.querySelector<HTMLElement>('[data-rib-visual]');
        if (!visual) return;

        visual.style.transform = `scaleX(${fisheyeScale(entry.center, pointerY).toFixed(3)})`;
      });
    });
  }, []);

  const updateDragTarget = useCallback(
    (clientY: number) => {
      const rail = railRef.current;
      const drag = dragRef.current;
      if (!rail || !drag?.dragging) return;

      const target = hitTestRib(measureRibLayout(rail), ribContentY(rail, clientY));
      const nextTurnId = target?.turnId ?? null;
      if (nextTurnId === drag.targetTurnId) return;

      drag.targetTurnId = nextTurnId;
      onPreviewTurnChange(nextTurnId);
    },
    [onPreviewTurnChange],
  );

  const updatePointerEffects = useCallback(
    (clientY: number) => {
      lastPointerClientYRef.current = clientY;
      applyFisheye(clientY);
      updateDragTarget(clientY);
    },
    [applyFisheye, updateDragTarget],
  );

  const releasePointerCapture = useCallback((pointerId: number) => {
    const rail = railRef.current;
    if (!rail?.hasPointerCapture?.(pointerId)) return;

    rail.releasePointerCapture(pointerId);
  }, []);

  const finishDrag = useCallback(
    (cancelled: boolean) => {
      const drag = dragRef.current;
      if (!drag) return;

      releasePointerCapture(drag.pointerId);
      dragRef.current = null;

      if (drag.dragging) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }

      if (!cancelled && drag.dragging && drag.targetTurnId) {
        const target = itemById.get(drag.targetTurnId);
        if (target) {
          onJumpTurn(target, { focusTarget: false });
        }
      }

      if (cancelled || !pointerInsideRef.current) {
        onPreviewTurnChange(null);
      }

      const rail = railRef.current;
      if (!pointerInsideRef.current && !rail?.contains(document.activeElement)) {
        setInteracting(false);
        resetFisheye();
      }
    },
    [itemById, onJumpTurn, onPreviewTurnChange, releasePointerCapture, resetFisheye],
  );

  const focusRib = useCallback(
    (turnId: string) => {
      const rib = findRibButton(turnId);
      if (!rib) return;

      setRovingTurnId(turnId);
      rib.focus();
    },
    [findRibButton],
  );

  useEffect(() => {
    const rail = railRef.current;
    if (rail?.contains(document.activeElement)) return;

    const fallback = items[0]?.turnId ?? null;
    setRovingTurnId(currentTurnId && itemById.has(currentTurnId) ? currentTurnId : fallback);
  }, [currentTurnId, itemById, items]);

  useEffect(() => {
    if (interacting || !currentTurnId) return;

    const rail = railRef.current;
    if (!rail) return;

    const current = findRibButton(currentTurnId);
    if (!current) return;

    const railRect = rail.getBoundingClientRect();
    const currentRect = current.getBoundingClientRect();
    const top = rail.scrollTop + currentRect.top - railRect.top;
    const bottom = top + currentRect.height;

    if (top < rail.scrollTop) {
      rail.scrollTop = top;
    } else if (bottom > rail.scrollTop + rail.clientHeight) {
      rail.scrollTop = bottom - rail.clientHeight;
    }
  }, [currentTurnId, findRibButton, interacting]);

  useEffect(() => {
    const handleWindowBlur = () => {
      finishDrag(true);
      resetFisheye();
      setInteracting(false);
    };

    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [finishDrag, resetFisheye]);

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

      const targetTurnId = currentTurnId ?? rovingTurnId ?? items[0]?.turnId;
      if (!targetTurnId) return;

      event.preventDefault();
      setInteracting(true);
      focusRib(targetTurnId);
    };

    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [currentTurnId, focusRib, items, rovingTurnId]);

  useEffect(
    () => () => {
      resetFisheye();
    },
    [resetFisheye],
  );

  const onRailPointerEnter = useCallback(() => {
    pointerInsideRef.current = true;
    setInteracting(true);
  }, []);

  const onRailPointerLeave = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      pointerInsideRef.current = false;
      if (dragRef.current?.dragging) return;

      resetFisheye();
      onPreviewTurnChange(null);
      if (!event.currentTarget.contains(document.activeElement)) {
        setInteracting(false);
      }
    },
    [onPreviewTurnChange, resetFisheye],
  );

  const onRailPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!(event.target instanceof Element)) return;

      const rib = event.target.closest<HTMLElement>('[data-nav-turn-id]');
      if (!rib?.dataset.navTurnId) return;

      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
        targetTurnId: rib.dataset.navTurnId,
      };
      lastPointerClientYRef.current = event.clientY;
      setInteracting(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      applyFisheye(event.clientY);
    },
    [applyFisheye],
  );

  const onRailPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      updatePointerEffects(event.clientY);

      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      if (!drag.dragging) {
        const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
        if (distance < DRAG_THRESHOLD_PX) return;

        drag.dragging = true;
        suppressClickRef.current = true;
        setInteracting(true);
        onPreviewTurnChange(drag.targetTurnId);
      }

      event.preventDefault();
      updateDragTarget(event.clientY);
    },
    [onPreviewTurnChange, updateDragTarget, updatePointerEffects],
  );

  const onRailPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      finishDrag(false);
    },
    [finishDrag],
  );

  const onRailPointerCancel = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      finishDrag(true);
    },
    [finishDrag],
  );

  const onRailFocusCapture = useCallback(() => {
    setInteracting(true);
  }, []);

  const onRailBlurCapture = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      const next = event.relatedTarget;
      if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
        if (!pointerInsideRef.current && !dragRef.current?.dragging) {
          setInteracting(false);
          resetFisheye();
        }
      }
    },
    [resetFisheye],
  );

  const onRailWheelCapture = useCallback(() => {
    setInteracting(true);
  }, []);

  const onRailScroll = useCallback(() => {
    const clientY = lastPointerClientYRef.current;
    if (clientY !== null) {
      updatePointerEffects(clientY);
    }
  }, [updatePointerEffects]);

  const onRibMouseEnter = useCallback(
    (item: SessionTurnNavigationItem) => {
      if (!dragRef.current?.dragging) {
        onPreviewTurnChange(item.turnId);
      }
    },
    [onPreviewTurnChange],
  );

  const onRibMouseLeave = useCallback(() => {
    if (!dragRef.current?.dragging) {
      onPreviewTurnChange(null);
    }
  }, [onPreviewTurnChange]);

  const onRibFocus = useCallback(
    (item: SessionTurnNavigationItem) => {
      setRovingTurnId(item.turnId);
      onPreviewTurnChange(item.turnId);
    },
    [onPreviewTurnChange],
  );

  const onRibBlur = useCallback(() => {
    if (!dragRef.current?.dragging) {
      onPreviewTurnChange(null);
    }
  }, [onPreviewTurnChange]);

  const onRibKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
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
        focusRib(next.turnId);
      }
    },
    [focusRib, items],
  );

  const onRibClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, item: SessionTurnNavigationItem) => {
      if (suppressClickRef.current) {
        event.preventDefault();
        event.stopPropagation();
        suppressClickRef.current = false;
        return;
      }

      onJumpTurn(item, { focusTarget: event.detail === 0 });
    },
    [onJumpTurn],
  );

  return {
    railRef,
    rovingTurnId,
    onRailPointerEnter,
    onRailPointerLeave,
    onRailPointerDown,
    onRailPointerMove,
    onRailPointerUp,
    onRailPointerCancel,
    onRailFocusCapture,
    onRailBlurCapture,
    onRailWheelCapture,
    onRailScroll,
    onRibMouseEnter,
    onRibMouseLeave,
    onRibFocus,
    onRibBlur,
    onRibKeyDown,
    onRibClick,
  };
}
