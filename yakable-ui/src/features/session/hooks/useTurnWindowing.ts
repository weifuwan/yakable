import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

const TURN_WINDOW_OVERSCAN_VIEWPORTS = 1.5;

export interface TurnWindowLayoutEntry {
  key: string;
  top: number;
  bottom: number;
  measured: boolean;
}

function sameKeys(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) return false;
  for (const key of left) {
    if (!right.has(key)) return false;
  }
  return true;
}

export function selectMountedTurnKeys(
  layout: TurnWindowLayoutEntry[],
  scrollTop: number,
  viewportHeight: number,
  pinnedKeys: ReadonlySet<string>,
) {
  const overscan = viewportHeight * TURN_WINDOW_OVERSCAN_VIEWPORTS;
  const windowTop = Math.max(0, scrollTop - overscan);
  const windowBottom = scrollTop + viewportHeight + overscan;
  const mounted = new Set<string>();

  for (const entry of layout) {
    if (
      pinnedKeys.has(entry.key) ||
      !entry.measured ||
      (entry.bottom > windowTop && entry.top < windowBottom)
    ) {
      mounted.add(entry.key);
    }
  }

  return mounted;
}

interface UseTurnWindowingOptions {
  scrollRef: RefObject<HTMLDivElement>;
  turnKeys: string[];
  pinnedTurnKeys: string[];
}

export function useTurnWindowing({
  scrollRef,
  turnKeys,
  pinnedTurnKeys,
}: UseTurnWindowingOptions) {
  const [measuredHeights, setMeasuredHeights] = useState<Map<string, number>>(() => new Map());
  const [mountedKeys, setMountedKeys] = useState<Set<string>>(() => new Set());
  const measuredHeightsRef = useRef(new Map<string, number>());
  const pinnedKeysRef = useRef(new Set<string>());
  const frameRef = useRef<number | null>(null);
  const turnKey = turnKeys.join('|');
  const pinnedKeys = useMemo(() => new Set(pinnedTurnKeys), [pinnedTurnKeys]);

  const measureWindow = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const activeElement = document.activeElement;
    const nextPinned = new Set(pinnedKeysRef.current);

    const layout = Array.from(container.querySelectorAll<HTMLElement>('[data-turn-key]'))
      .map((element): TurnWindowLayoutEntry | null => {
        const key = element.dataset.turnKey;
        if (!key) return null;

        if (activeElement instanceof Node && element.contains(activeElement)) {
          nextPinned.add(key);
        }

        const rect = element.getBoundingClientRect();
        const top = container.scrollTop + rect.top - containerRect.top;

        return {
          key,
          top,
          bottom: top + rect.height,
          measured: measuredHeightsRef.current.has(key),
        };
      })
      .filter((entry): entry is TurnWindowLayoutEntry => entry !== null);

    const nextMounted = selectMountedTurnKeys(
      layout,
      container.scrollTop,
      container.clientHeight,
      nextPinned,
    );
    setMountedKeys((current) => (sameKeys(current, nextMounted) ? current : nextMounted));
  }, [scrollRef]);

  const scheduleMeasure = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      measureWindow();
    });
  }, [measureWindow]);

  const reportTurnHeight = useCallback(
    (key: string, height: number) => {
      if (!Number.isFinite(height) || height <= 0) return;

      setMeasuredHeights((current) => {
        const previous = current.get(key);
        if (previous !== undefined && Math.abs(previous - height) < 1) return current;

        const next = new Map(current);
        next.set(key, height);
        measuredHeightsRef.current = next;
        return next;
      });
      scheduleMeasure();
    },
    [scheduleMeasure],
  );

  useEffect(() => {
    pinnedKeysRef.current = pinnedKeys;
    scheduleMeasure();
  }, [pinnedKeys, scheduleMeasure]);

  useEffect(() => {
    scheduleMeasure();
  }, [scheduleMeasure, turnKey]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleGeometryChange = () => scheduleMeasure();
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleGeometryChange);

    container.addEventListener('scroll', handleGeometryChange, { passive: true });
    container.addEventListener('focusin', handleGeometryChange);
    container.addEventListener('focusout', handleGeometryChange);
    resizeObserver?.observe(container);

    return () => {
      container.removeEventListener('scroll', handleGeometryChange);
      container.removeEventListener('focusin', handleGeometryChange);
      container.removeEventListener('focusout', handleGeometryChange);
      resizeObserver?.disconnect();

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [scheduleMeasure, scrollRef]);

  const isTurnMounted = useCallback(
    (key: string) => !measuredHeights.has(key) || mountedKeys.has(key) || pinnedKeys.has(key),
    [measuredHeights, mountedKeys, pinnedKeys],
  );

  const measuredHeight = useCallback(
    (key: string) => measuredHeights.get(key) ?? null,
    [measuredHeights],
  );

  return {
    isTurnMounted,
    measuredHeight,
    reportTurnHeight,
    measuredTurnCount: measuredHeights.size,
    mountedTurnCount: mountedKeys.size,
  };
}
