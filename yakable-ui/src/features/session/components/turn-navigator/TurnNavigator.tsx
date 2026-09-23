import type { MouseEvent } from 'react';

import type { SessionTurnNavigationItem } from '@/service/session';
import { cx, Icon, IconButton } from '@/shared/ui';

import type { TurnJumpOptions } from './turn-navigation';
import { useTurnNavigatorInteraction } from './useTurnNavigatorInteraction';

interface TurnNavigatorProps {
  items: SessionTurnNavigationItem[];
  currentTurnId: string | null;
  visibleTurnIds: string[];
  previewItem: SessionTurnNavigationItem | null;
  isJumping: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  onPreviewTurnChange: (turnId: string | null) => void;
  onJumpTurn: (item: SessionTurnNavigationItem, options?: TurnJumpOptions) => void;
  onPrevious: (options?: TurnJumpOptions) => void;
  onNext: (options?: TurnJumpOptions) => void;
  onOrigin: (options?: TurnJumpOptions) => void;
  onTerminus: (options?: TurnJumpOptions) => void;
}

function NavigatorArrow({ direction }: { direction: 'up' | 'down' }) {
  return (
    <Icon size={14}>
      {direction === 'up' ? <path d="m8 14 4-4 4 4" /> : <path d="m8 10 4 4 4-4" />}
    </Icon>
  );
}

function keyboardActivated(event: MouseEvent<HTMLElement>) {
  return event.detail === 0;
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
  const visibleSet = new Set(visibleTurnIds);
  const {
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
  } = useTurnNavigatorInteraction({
    items,
    currentTurnId,
    onPreviewTurnChange,
    onJumpTurn,
  });

  if (items.length < 3) return null;

  return (
    <aside
      aria-label="Turn navigator"
      aria-keyshortcuts="Alt+Shift+M"
      aria-busy={isJumping}
      className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 md:flex"
    >
      <div className="relative flex flex-col items-center rounded-xl border border-border-quiet bg-surface/90 px-1.5 py-1 shadow-sm backdrop-blur">
        {previewItem && (
          <div
            id="turn-navigator-preview"
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
          disabled={!hasPrevious}
          onClick={(event) => onPrevious({ focusTarget: keyboardActivated(event) })}
        >
          <NavigatorArrow direction="up" />
        </IconButton>

        <button
          type="button"
          aria-label="Go to conversation start"
          className="flex h-4 w-9 cursor-pointer items-center justify-center rounded-md text-icon-muted outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus-ring"
                    onClick={(event) => onOrigin({ focusTarget: keyboardActivated(event) })}
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        </button>

        <div
          ref={railRef}
          data-testid="turn-navigator-rail"
          className="flex max-h-56 w-10 touch-none select-none flex-col items-center overflow-y-auto py-1"
          onPointerEnter={onRailPointerEnter}
          onPointerLeave={onRailPointerLeave}
          onPointerDown={onRailPointerDown}
          onPointerMove={onRailPointerMove}
          onPointerUp={onRailPointerUp}
          onPointerCancel={onRailPointerCancel}
          onFocusCapture={onRailFocusCapture}
          onBlurCapture={onRailBlurCapture}
          onWheelCapture={onRailWheelCapture}
          onScroll={onRailScroll}
        >
          {items.map((item, index) => {
            const current = item.turnId === currentTurnId;
            const visible = visibleSet.has(item.turnId);
            const roving = item.turnId === rovingTurnId;
            const previewed = item.turnId === previewItem?.turnId;

            return (
              <button
                key={item.turnId}
                type="button"
                data-nav-turn-id={item.turnId}
                aria-label={'Go to turn ' + (index + 1)}
                aria-current={current ? 'true' : undefined}
                aria-describedby={previewed ? 'turn-navigator-preview' : undefined}
                tabIndex={roving ? 0 : -1}
                                className={cx(
                  'flex h-4 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none focus-visible:outline-2 focus-visible:outline-focus-ring',
                  current ? 'text-foreground' : visible ? 'text-icon-secondary' : 'text-icon-muted',
                )}
                onMouseEnter={() => onRibMouseEnter(item)}
                onMouseLeave={onRibMouseLeave}
                onFocus={() => onRibFocus(item)}
                onBlur={onRibBlur}
                onKeyDown={(event) => onRibKeyDown(event, index)}
                onClick={(event) => onRibClick(event, item)}
              >
                <span
                  aria-hidden="true"
                  data-rib-visual
                  className={cx(
                    'h-0.5 rounded-full bg-current transition-[width] duration-100 will-change-transform',
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
                    onClick={(event) => onTerminus({ focusTarget: keyboardActivated(event) })}
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        </button>

        <IconButton
          aria-label="Next turn"
          size="sm"
          disabled={!hasNext}
          onClick={(event) => onNext({ focusTarget: keyboardActivated(event) })}
        >
          <NavigatorArrow direction="down" />
        </IconButton>
      </div>
    </aside>
  );
}
