import { PromptComposerSurfaceEffects } from './PromptComposerSurfaceEffects';
import './prompt-composer.css';

export function PromptComposerSkeleton() {
  return (
    <div className="yak-composer-root">
      <div
        className="yak-composer-surface p-3"
        role="status"
        aria-label="Loading prompt composer"
        data-testid="prompt-composer-skeleton"
      >
        <PromptComposerSurfaceEffects />

        <div className="relative z-10">
          <div className="min-h-14 px-2 py-1">
            <div className="h-4 w-2/5 animate-pulse rounded-full bg-skeleton" />
          </div>

          <div className="flex min-h-8 items-center justify-between gap-3 px-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="size-8 animate-pulse rounded-full bg-skeleton" />
              <div className="h-8 w-20 animate-pulse rounded-full bg-skeleton" />
              <div className="size-8 animate-pulse rounded-full bg-skeleton" />
            </div>

            <div className="size-8 animate-pulse rounded-full bg-skeleton" />
          </div>
        </div>
      </div>
    </div>
  );
}
