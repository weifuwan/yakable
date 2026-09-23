export const READING_ANCHOR_RATIO = 0.3;

export interface TurnLayoutEntry {
  turnId: string;
  element: HTMLElement;
  top: number;
  bottom: number;
}

export function measureTurnLayout(container: HTMLElement): TurnLayoutEntry[] {
  const containerRect = container.getBoundingClientRect();

  return Array.from(container.querySelectorAll<HTMLElement>('[data-turn-id]'))
    .map((element) => {
      const turnId = element.dataset.turnId;
      if (!turnId) return null;

      const rect = element.getBoundingClientRect();
      const top = container.scrollTop + rect.top - containerRect.top;

      return {
        turnId,
        element,
        top,
        bottom: top + rect.height,
      };
    })
    .filter((entry): entry is TurnLayoutEntry => entry !== null)
    .sort((left, right) => left.top - right.top);
}

export function currentTurnAtReadingAnchor(
  layout: TurnLayoutEntry[],
  scrollTop: number,
  viewportHeight: number,
) {
  if (layout.length === 0) return null;

  const readingAnchor = scrollTop + viewportHeight * READING_ANCHOR_RATIO;
  let current = layout[0];

  for (const entry of layout) {
    if (readingAnchor < entry.top) break;

    current = entry;
    if (readingAnchor < entry.bottom) break;
  }

  return current.turnId;
}

export function visibleTurnIds(
  layout: TurnLayoutEntry[],
  scrollTop: number,
  viewportHeight: number,
) {
  const viewportBottom = scrollTop + viewportHeight;

  return layout
    .filter((entry) => entry.bottom > scrollTop && entry.top < viewportBottom)
    .map((entry) => entry.turnId);
}

export function targetScrollTop(
  entry: TurnLayoutEntry,
  viewportHeight: number,
  scrollHeight: number,
) {
  const target = entry.top - viewportHeight * READING_ANCHOR_RATIO;
  const maxScrollTop = Math.max(0, scrollHeight - viewportHeight);
  return Math.min(Math.max(0, target), maxScrollTop);
}

export function findTurnElement(container: HTMLElement, turnId: string) {
  return (
    Array.from(container.querySelectorAll<HTMLElement>('[data-turn-id]')).find(
      (element) => element.dataset.turnId === turnId,
    ) ?? null
  );
}

export function hasLoadedTurnStart(element: HTMLElement) {
  return element.dataset.turnUserLoaded === 'true';
}

export const DRAG_THRESHOLD_PX = 4;
export const FISHEYE_RADIUS_PX = 36;
export const FISHEYE_MAX_SCALE = 1.75;

export interface TurnJumpOptions {
  focusTarget?: boolean;
}

export interface RibLayoutEntry {
  turnId: string;
  element: HTMLElement;
  top: number;
  bottom: number;
  center: number;
}

export function measureRibLayout(column: HTMLElement): RibLayoutEntry[] {
  const columnRect = column.getBoundingClientRect();

  return Array.from(column.querySelectorAll<HTMLElement>('[data-nav-turn-id]'))
    .map((element) => {
      const turnId = element.dataset.navTurnId;
      if (!turnId) return null;

      const rect = element.getBoundingClientRect();
      const top = column.scrollTop + rect.top - columnRect.top;
      const bottom = top + rect.height;

      return {
        turnId,
        element,
        top,
        bottom,
        center: top + rect.height / 2,
      };
    })
    .filter((entry): entry is RibLayoutEntry => entry !== null)
    .sort((left, right) => left.top - right.top);
}

export function ribContentY(column: HTMLElement, clientY: number) {
  return clientY - column.getBoundingClientRect().top + column.scrollTop;
}

export function hitTestRib(layout: RibLayoutEntry[], contentY: number) {
  if (layout.length === 0) return null;

  const containing = layout.find((entry) => contentY >= entry.top && contentY < entry.bottom);
  if (containing) return containing;

  return layout.reduce((nearest, entry) =>
    Math.abs(entry.center - contentY) < Math.abs(nearest.center - contentY) ? entry : nearest,
  );
}

export function fisheyeScale(centerY: number, pointerY: number) {
  const distance = Math.abs(centerY - pointerY);
  if (distance >= FISHEYE_RADIUS_PX) return 1;

  const influence = 1 - distance / FISHEYE_RADIUS_PX;
  return 1 + influence * (FISHEYE_MAX_SCALE - 1);
}
