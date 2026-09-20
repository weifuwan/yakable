import { useId, type ReactNode } from 'react';

import { cx } from '../cx';
import { Icon } from '../icon';

export function PromptComposerActions({
  canSubmit,
  isSubmitting,
  leadingActions,
  onStop,
  onSubmit,
  running,
  stopLabel,
  submitLabel,
  submitTooltip,
  trailingActions,
}: {
  canSubmit: boolean;
  isSubmitting: boolean;
  leadingActions?: ReactNode;
  onStop?: () => void;
  onSubmit: () => void;
  running: boolean;
  stopLabel: string;
  submitLabel: string;
  submitTooltip: string;
  trailingActions?: ReactNode;
}) {
  const tooltipId = useId();
  const stoppingEnabled = running && Boolean(onStop);
  const label = stoppingEnabled ? stopLabel : submitLabel;
  const tooltip = stoppingEnabled ? stopLabel : submitTooltip;

  return (
    <div className="flex min-h-8 items-center justify-between gap-3 px-1">
      <div className="flex min-w-0 items-center gap-1">{leadingActions}</div>

      <div className="flex shrink-0 items-center gap-1.5">
        {trailingActions}

        <div className="group relative">
          <span
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none absolute right-0 bottom-full z-20 mb-2 hidden items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#20201e] px-2.5 py-1.5 text-xs font-medium text-white group-hover:flex group-focus-within:flex"
          >
            <span>{tooltip}</span>
            {!stoppingEnabled && (
              <kbd className="rounded bg-white/10 px-1 py-0.5 text-[10px] leading-none text-white/70">
                ↵
              </kbd>
            )}
          </span>

          <button
            type="button"
            aria-label={label}
            aria-describedby={tooltipId}
            disabled={stoppingEnabled ? false : !canSubmit}
            onClick={stoppingEnabled ? onStop : onSubmit}
            className={cx(
              'inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-white outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/50 disabled:pointer-events-none disabled:cursor-default disabled:bg-black/[0.08] disabled:text-black/25',
              stoppingEnabled
                ? 'bg-[#2f7df4] hover:bg-[#2f7df4]'
                : 'bg-[#20201e] hover:bg-[#343431]',
            )}
          >
            {stoppingEnabled ? (
              <span
                aria-hidden="true"
                className="size-2.5 rounded-[2px] bg-white"
              />
            ) : isSubmitting ? (
              <span
                aria-hidden="true"
                className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
              />
            ) : (
              <Icon size={20} viewBox="0 0 20 20" strokeWidth={1.5}>
                <path d="M10 15.5V4.5" />
                <path d="M5.75 8.75 10 4.5l4.25 4.25" />
              </Icon>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
