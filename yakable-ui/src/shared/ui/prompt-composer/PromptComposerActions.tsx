import type { ReactNode } from 'react';

import { Icon } from '../icon';

export function PromptComposerActions({
  canSubmit,
  isSubmitting,
  leadingActions,
  onSubmit,
  submitLabel,
  trailingActions,
}: {
  canSubmit: boolean;
  isSubmitting: boolean;
  leadingActions?: ReactNode;
  onSubmit: () => void;
  submitLabel: string;
  trailingActions?: ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 px-1">
      <div className="flex min-w-0 items-center gap-1">{leadingActions}</div>

      <div className="flex shrink-0 items-center gap-1.5">
        {trailingActions}
        <button
          type="button"
          aria-label={submitLabel}
          disabled={!canSubmit}
          onClick={onSubmit}
          className="inline-flex size-8 items-center justify-center rounded-full bg-[#20201e] text-white outline-none transition-colors hover:bg-[#343431] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/50 disabled:pointer-events-none disabled:bg-black/[0.08] disabled:text-black/25"
        >
          {isSubmitting ? (
            <span
              aria-hidden="true"
              className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
            />
          ) : (
            <Icon size={17}>
              <path d="M12 19V5" />
              <path d="m6.5 10.5 5.5-5.5 5.5 5.5" />
            </Icon>
          )}
        </button>
      </div>
    </div>
  );
}
