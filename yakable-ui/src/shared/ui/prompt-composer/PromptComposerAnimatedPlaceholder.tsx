import { useEffect, useState } from 'react';

const TYPE_DELAY_MS = 52;
const DELETE_DELAY_MS = 28;
const HOLD_DELAY_MS = 1400;
const NEXT_DELAY_MS = 260;

type TypewriterPhase = 'typing' | 'deleting';

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function PromptComposerAnimatedPlaceholder({
  prefix,
  suggestions,
}: {
  prefix: string;
  suggestions: readonly string[];
}) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [visibleLength, setVisibleLength] = useState(0);
  const [phase, setPhase] = useState<TypewriterPhase>('typing');
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);


  const currentSuggestion =
    suggestions[phraseIndex % Math.max(suggestions.length, 1)] ?? '';
  const visibleSuggestion = reducedMotion
    ? currentSuggestion
    : currentSuggestion.slice(0, visibleLength);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => {
      setReducedMotion(media.matches);
    };

    handleChange();
    media.addEventListener?.('change', handleChange);

    return () => {
      media.removeEventListener?.('change', handleChange);
    };
  }, []);

  useEffect(() => {
    if (suggestions.length === 0 || reducedMotion) return;

    let delay = TYPE_DELAY_MS;
    let next: () => void;

    if (phase === 'typing') {
      if (visibleLength < currentSuggestion.length) {
        next = () => {
          setVisibleLength((current) => current + 1);
        };
      } else {
        delay = HOLD_DELAY_MS;
        next = () => {
          setPhase('deleting');
        };
      }
    } else if (phase === 'deleting') {
      if (visibleLength > 0) {
        delay = DELETE_DELAY_MS;
        next = () => {
          setVisibleLength((current) => Math.max(0, current - 1));
        };
      } else {
        delay = NEXT_DELAY_MS;
        next = () => {
          const count = Math.max(suggestions.length, 1);
          setPhraseIndex((current) => (current + 1) % count);
          setPhase('typing');
        };
      }
    }

    const timer = window.setTimeout(next, delay);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    currentSuggestion,
    phase,
    reducedMotion,
    suggestions.length,
    visibleLength,
  ]);

  if (suggestions.length === 0) return null;

  return (
    <span
      aria-hidden="true"
      data-testid="prompt-composer-animated-placeholder"
      className="pointer-events-none absolute inset-x-0 top-0 px-2 py-1 text-[15px] leading-6 text-foreground-placeholder"
    >
      <span>{prefix}</span>
      {visibleSuggestion && <span> {visibleSuggestion}</span>}
      {!reducedMotion && (
        <span
          aria-hidden="true"
          className="yak-composer-placeholder-caret"
        />
      )}
    </span>
  );
}
