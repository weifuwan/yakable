import type { ReactNode } from 'react';

import { cx } from '../cx';
import { PromptComposerActions } from './PromptComposerActions';
import { PromptComposerAnimatedPlaceholder } from './PromptComposerAnimatedPlaceholder';
import { PromptComposerSurfaceEffects } from './PromptComposerSurfaceEffects';
import {
  useComposerInput,
  type PromptComposerSubmitHandler,
} from './useComposerInput';
import './prompt-composer.css';

export interface PromptComposerProps {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  leadingActions?: ReactNode;
  onStop?: () => void;
  onSubmit?: PromptComposerSubmitHandler;
  placeholder?: string;
  placeholderPrefix?: string;
  placeholderSuggestions?: readonly string[];
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
  placeholderPrefix,
  placeholderSuggestions,
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

  const animatedPlaceholder =
    Boolean(placeholderPrefix) &&
    Boolean(placeholderSuggestions?.length);

  return (
    <div
      className={cx(
        'yak-composer-root',
        disabled && 'opacity-55',
        className,
      )}
    >
      <span
        aria-hidden="true"
        data-testid="prompt-composer-halo"
        className="yak-composer-halo"
      />

      <div
        data-testid="prompt-composer-surface"
        className="yak-composer-surface p-3"
      >
        <PromptComposerSurfaceEffects />

        <div className="relative z-10">
          <div className="relative">
            {animatedPlaceholder && value.length === 0 && (
              <PromptComposerAnimatedPlaceholder
                prefix={placeholderPrefix ?? ''}
                suggestions={placeholderSuggestions ?? []}
              />
            )}

            <textarea
              ref={textareaRef}
              aria-label={ariaLabel}
              autoComplete="off"
              disabled={disabled}
              rows={1}
              value={value}
              placeholder={animatedPlaceholder ? undefined : placeholder}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              className="relative block min-h-14 w-full resize-none bg-transparent px-2 py-1 text-[15px] leading-6 text-foreground outline-none placeholder:text-foreground-placeholder disabled:cursor-not-allowed"
            />
          </div>

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
      </div>
    </div>
  );
}
