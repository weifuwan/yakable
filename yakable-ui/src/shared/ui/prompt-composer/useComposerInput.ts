import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';

export type PromptComposerSubmitResult =
  | void
  | boolean
  | Promise<void | boolean>;

export type PromptComposerSubmitHandler = (
  value: string,
) => PromptComposerSubmitResult;

const MIN_TEXTAREA_HEIGHT = 56;
const MAX_TEXTAREA_HEIGHT = 160;
const COMPOSITION_END_DELAY_MS = 50;

function resizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return;

  element.style.height = 'auto';

  const nextHeight = Math.min(
    Math.max(element.scrollHeight, MIN_TEXTAREA_HEIGHT),
    MAX_TEXTAREA_HEIGHT,
  );

  element.style.height = `${nextHeight}px`;
  element.style.overflowY =
    element.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
}

export function useComposerInput({
  disabled = false,
  onSubmit,
  onValueChange,
  value: controlledValue,
}: {
  disabled?: boolean;
  onSubmit?: PromptComposerSubmitHandler;
  onValueChange?: (value: string) => void;
  value?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const compositionEndTimerRef = useRef<number | null>(null);
  const isComposingRef = useRef(false);
  const [internalValue, setInternalValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const value = controlledValue ?? internalValue;

  const setValue = useCallback(
    (nextValue: string) => {
      if (controlledValue === undefined) {
        setInternalValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [controlledValue, onValueChange],
  );

  const normalizedValue = value.trim();
  const canSubmit =
    Boolean(onSubmit) &&
    normalizedValue.length > 0 &&
    !disabled &&
    !isSubmitting;

  useLayoutEffect(() => {
    resizeTextarea(textareaRef.current);
  }, [value]);

  useEffect(
    () => () => {
      if (compositionEndTimerRef.current !== null) {
        window.clearTimeout(compositionEndTimerRef.current);
      }
    },
    [],
  );

  const submit = useCallback(async () => {
    if (!onSubmit || !canSubmit) return false;

    setIsSubmitting(true);

    try {
      const accepted = await onSubmit(normalizedValue);
      if (accepted === false) return false;

      setValue('');
      return true;
    } catch {
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, normalizedValue, onSubmit, setValue]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setValue(event.target.value);
    },
    [setValue],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.key !== 'Enter' ||
        event.shiftKey ||
        event.nativeEvent.isComposing ||
        isComposingRef.current
      ) {
        return;
      }

      event.preventDefault();
      void submit();
    },
    [submit],
  );

  const handleCompositionStart = useCallback(() => {
    if (compositionEndTimerRef.current !== null) {
      window.clearTimeout(compositionEndTimerRef.current);
      compositionEndTimerRef.current = null;
    }
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    if (compositionEndTimerRef.current !== null) {
      window.clearTimeout(compositionEndTimerRef.current);
    }

    compositionEndTimerRef.current = window.setTimeout(() => {
      compositionEndTimerRef.current = null;
      isComposingRef.current = false;
    }, COMPOSITION_END_DELAY_MS);
  }, []);

  return {
    canSubmit,
    handleChange,
    handleCompositionEnd,
    handleCompositionStart,
    handleKeyDown,
    isSubmitting,
    submit,
    textareaRef,
    value,
  };
}
