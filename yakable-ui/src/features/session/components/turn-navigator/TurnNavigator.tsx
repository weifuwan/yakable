import { useEffect, useRef, useState } from 'react';

import type { SessionTurnNavigationItem } from '@/service/session';
import { cx, Icon, IconButton } from '@/shared/ui';

interface TurnNavigatorProps {
  items: SessionTurnNavigationItem[];
  currentTurnId: string | null;
  visibleTurnIds: string[];
  previewItem: SessionTurnNavigationItem | null;
  isJumping: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  onPreviewTurnChange: (turnId: string | null) => void;
  onJumpTurn: (item: SessionTurnNavigationItem) => void;
  onPrevious: () => void;
  onNext: () => void;
  onOrigin: () => void;
  onTerminus: () => void;
}

function NavigatorArrow({ direction }: { direction: 'up' | 'down' }) {
  return (
    <Icon size={14}>
      {direction === 'up' ? <path d="m8 14 4-4 4 4" /> : <path d="m8 10 4 4 4-4" />}
    </Icon>
  );
}

export function TurnNavigator({
  items,
  currentTurnId,
  visibleTurnIds,
  previewItem,
  isJumping,
  hasPrevious,
  hasNext,
  onPreviewTurnChange,
  onJumpTurn,
  onPrevious,
  onNext,
  onOrigin,
  onTerminus,
}: TurnNavigatorProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [interacting, setInteracting] = useState(false);
  const visibleSet = new Set(visibleTurnIds);

  useEffect(() => {
    if (interacting || !currentTurnId) return;

    const rail = railRef.current;
    if (!rail) return;

    const current = Array.from(rail.querySelectorAll<HTMLElement>('[data-nav-turn-id]')).find(
      (element) => element.dataset.navTurnId === currentTurnId,
    );
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
  }, [currentTurnId, interacting]);

  if (items.length < 3) return null;

  return (
    <aside
      aria-label="Turn navigator"
      className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 md:flex"
    >
      <div className="relative flex flex-col items-center rounded-xl border border-border-quiet bg-surface/90 px-1.5 py-1 shadow-sm backdrop-blur">
        {previewItem && (
          <div
            role="tooltip"
            data-testid="turn-navigator-preview"
            className="pointer-events-none absolute right-full top-1/2 mr-3 w-64 -translate-y-1/2 rounded-xl border border-border-quiet bg-surface px-3 py-2 text-xs leading-5 text-foreground shadow-sm"
          >
            {previewItem.preview}
          </div>
        )}

        <IconButton
          aria-label="Previous turn"
          size="sm"
          disabled={!hasPrevious || isJumping}
          onClick={onPrevious}
        >
          <NavigatorArrow direction="up" />
        </IconButton>

        <button
          type="button"
          aria-label="Go to conversation start"
          className="flex h-4 w-9 cursor-pointer items-center justify-center rounded-md text-icon-muted outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus-ring"
          disabled={isJumping}
          onClick={onOrigin}
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        </button>

        <div
          ref={railRef}
          className="flex max-h-56 w-10 flex-col items-center overflow-y-auto py-1"
          onPointerEnter={() => setInteracting(true)}
          onPointerLeave={(event) => {
            if (!event.currentTarget.contains(document.activeElement)) {
              setInteracting(false);
            }
          }}
          onFocusCapture={() => setInteracting(true)}
          onBlurCapture={(event) => {
            const next = event.relatedTarget;
            if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
              setInteracting(false);
            }
          }}
          onWheelCapture={() => setInteracting(true)}
        >
          {items.map((item, index) => {
            const current = item.turnId === currentTurnId;
            const visible = visibleSet.has(item.turnId);

            return (
              <button
                key={item.turnId}
                type="button"
                data-nav-turn-id={item.turnId}
                aria-label={'Go to turn ' + (index + 1)}
                aria-current={current ? 'true' : undefined}
                tabIndex={current ? 0 : -1}
                disabled={isJumping}
                className={cx(
                  'flex h-4 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none focus-visible:outline-2 focus-visible:outline-focus-ring',
                  current ? 'text-foreground' : visible ? 'text-icon-secondary' : 'text-icon-muted',
                )}
                onMouseEnter={() => onPreviewTurnChange(item.turnId)}
                onMouseLeave={() => onPreviewTurnChange(null)}
                onFocus={() => onPreviewTurnChange(item.turnId)}
                onBlur={() => onPreviewTurnChange(null)}
                onClick={() => onJumpTurn(item)}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'h-0.5 rounded-full bg-current transition-[width] duration-100',
                    current ? 'w-7' : visible ? 'w-5' : 'w-3',
                  )}
                />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-label="Go to latest"
          className="flex h-4 w-9 cursor-pointer items-center justify-center rounded-md text-icon-muted outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus-ring"
          disabled={isJumping}
          onClick={onTerminus}
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        </button>

        <IconButton
          aria-label="Next turn"
          size="sm"
          disabled={!hasNext || isJumping}
          onClick={onNext}
        >
          <NavigatorArrow direction="down" />
        </IconButton>
      </div>
    </aside>
  );
}
