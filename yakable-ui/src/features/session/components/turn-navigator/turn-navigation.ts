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
