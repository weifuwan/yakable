import type { ReactNode } from 'react';

import { cx } from '../cx';
import { PromptComposerActions } from './PromptComposerActions';
import {
  useComposerInput,
  type PromptComposerSubmitHandler,
} from './useComposerInput';

export interface PromptComposerProps {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  leadingActions?: ReactNode;
  onStop?: () => void;
  onSubmit?: PromptComposerSubmitHandler;
  placeholder?: string;
  running?: boolean;
  stopLabel?: string;
  submitLabel?: string;
  submitTooltip?: string;
  trailingActions?: ReactNode;
}

export function PromptComposer({
  ariaLabel = 'Prompt',
  className,
  disabled = false,
  leadingActions,
  onStop,
  onSubmit,
  placeholder = 'Ask Yakable to build...',
  running = false,
  stopLabel = 'Stop generating',
  submitLabel = 'Submit prompt',
  submitTooltip = 'Send prompt',
  trailingActions,
}: PromptComposerProps) {
  const {
    canSubmit,
    handleChange,
    handleCompositionEnd,
    handleCompositionStart,
    handleKeyDown,
    isSubmitting,
    submit,
    textareaRef,
    value,
  } = useComposerInput({
    disabled: disabled || running,
    onSubmit,
  });

  return (
    <div
      className={cx(
        'w-full rounded-[24px] border border-black/[0.10] bg-white p-3',
        'focus-within:border-black/[0.18]',
        disabled && 'opacity-55',
        className,
      )}
    >
      <textarea
        ref={textareaRef}
        aria-label={ariaLabel}
        autoComplete="off"
        disabled={disabled}
        rows={1}
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        className="block min-h-14 w-full resize-none bg-transparent px-2 py-1 text-[15px] leading-6 text-[#20201e] outline-none placeholder:text-black/38 disabled:cursor-not-allowed"
      />

      <PromptComposerActions
        canSubmit={canSubmit}
        isSubmitting={isSubmitting}
        leadingActions={leadingActions}
        running={running}
        stopLabel={stopLabel}
        trailingActions={trailingActions}
        submitLabel={submitLabel}
        submitTooltip={submitTooltip}
        onStop={onStop}
        onSubmit={() => {
          void submit();
        }}
      />
    </div>
  );
}
