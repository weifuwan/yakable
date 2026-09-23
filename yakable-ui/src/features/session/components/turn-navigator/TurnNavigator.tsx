import type { SessionTurnNavigationItem } from '@/service/session';
import { cx } from '@/shared/ui';

import type { TurnJumpOptions } from './turn-navigation';
import { useTurnNavigatorInteraction } from './useTurnNavigatorInteraction';

interface TurnNavigatorProps {
  items: SessionTurnNavigationItem[];
  currentTurnId: string | null;
  isJumping: boolean;
  onJumpTurn: (item: SessionTurnNavigationItem, options?: TurnJumpOptions) => void;
}

export function TurnNavigator({ items, currentTurnId, isJumping, onJumpTurn }: TurnNavigatorProps) {
  const {
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
  } = useTurnNavigatorInteraction({
    items,
    currentTurnId,
    onJumpTurn,
  });

  if (items.length < 3) return null;

  return (
    <aside
      aria-label="Turn navigator"
      aria-keyshortcuts="Alt+Shift+M"
      aria-busy={isJumping}
      className="absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 md:block"
    >
      <div
        ref={surfaceRef}
        data-testid="turn-navigator-surface"
        className="relative"
        onFocusCapture={onSurfaceFocusCapture}
        onBlurCapture={onSurfaceBlurCapture}
        onPointerMoveCapture={onSurfacePointerMoveCapture}
        onPointerDownCapture={onSurfacePointerDownCapture}
        onWheelCapture={onSurfaceWheelCapture}
      >
        <button
          ref={railRef}
          type="button"
          aria-label="Browse conversation turns"
          aria-expanded={isOpen}
          aria-controls={isOpen ? 'turn-navigator-overview' : undefined}
          className="flex max-h-56 w-8 cursor-pointer flex-col items-end gap-1.5 overflow-y-auto rounded-md p-1.5 outline-none focus-visible:outline-2 focus-visible:outline-focus-ring"
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          onFocus={onRailFocus}
          onClick={onRailClick}
          onKeyDown={onRailKeyDown}
        >
          {items.map((item) => {
            const current = item.turnId === currentTurnId;

            return (
              <span
                key={item.turnId}
                aria-hidden="true"
                data-testid="turn-navigator-marker"
                data-nav-marker-turn-id={item.turnId}
                className={cx(
                  'h-0.5 shrink-0 rounded-full bg-current',
                  current ? 'w-5 text-foreground' : 'w-4 text-icon-muted',
                )}
              />
            );
          })}
        </button>

        {isOpen && (
          <nav
            ref={overviewRef}
            id="turn-navigator-overview"
            aria-label="Conversation prompts"
            data-testid="turn-navigator-overview"
            className="absolute right-full top-1/2 mr-2 w-80 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border-quiet bg-surface p-1.5 shadow-md"
            style={{ maxHeight: 'min(20rem, calc(100vh - 6rem))' }}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
          >
            {items.map((item, index) => {
              const current = item.turnId === currentTurnId;
              const roving = item.turnId === rovingTurnId;

              return (
                <button
                  key={item.turnId}
                  type="button"
                  data-nav-turn-id={item.turnId}
                  aria-label={'Go to turn ' + (index + 1) + ': ' + item.preview}
                  aria-current={current ? 'true' : undefined}
                  tabIndex={roving ? 0 : -1}
                  title={item.preview}
                  className={cx(
                    'block w-full cursor-pointer truncate rounded-xl px-3 py-2 text-left text-sm outline-none focus-visible:outline-2 focus-visible:outline-focus-ring',
                    current
                      ? 'bg-surface-selected text-foreground'
                      : 'text-foreground-secondary hover:bg-surface-hover-subtle',
                  )}
                  onFocus={() => onRowFocus(item)}
                  onKeyDown={(event) => onRowKeyDown(event, index, item)}
                  onClick={(event) => onRowClick(event, item)}
                >
                  {item.preview}
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </aside>
  );
}
