import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cva, type VariantProps } from 'class-variance-authority';

import { cx } from '../cx';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export type SelectSide = 'auto' | 'top' | 'bottom';
export type SelectAlign = 'start' | 'center' | 'end';

const selectTriggerVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full border border-border-control bg-surface font-medium text-foreground outline-none transition-colors hover:bg-surface-hover-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring-strong disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40',
  {
    variants: {
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-9 px-3 text-sm',
      },
    },
    defaultVariants: {
      size: 'sm',
    },
  },
);

export interface SelectProps
  extends Omit<
      ButtonHTMLAttributes<HTMLButtonElement>,
      'defaultValue' | 'onChange' | 'value'
    >,
    VariantProps<typeof selectTriggerVariants> {
  options: readonly SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  side?: SelectSide;
  align?: SelectAlign;
  footer?: ReactNode;
  contentClassName?: string;
}

interface SelectPosition {
  top: number;
  left: number;
  maxHeight: number;
  side: 'top' | 'bottom';
}

const VIEWPORT_PADDING = 8;
const CONTENT_GAP = 6;
const MIN_CONTENT_HEIGHT = 96;

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="currentColor"
    >
      <path d="M18.369 4.595a.75.75 0 0 1 1.262.81l-9 14a.75.75 0 0 1-1.217.064l-5-6.25a.75.75 0 1 1 1.172-.938l4.347 5.435z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cx(
        'size-4 shrink-0 transition-transform duration-150',
        open && 'rotate-180',
      )}
      fill="currentColor"
    >
      <path d="M11.526 15.582a.75.75 0 0 0 1.004-.052l5-5a.75.75 0 0 0-1.06-1.06L12 13.94 7.53 9.47a.75.75 0 0 0-1.06 1.06l5 5z" />
    </svg>
  );
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    align = 'end',
    className,
    contentClassName,
    defaultValue,
    disabled = false,
    footer,
    id,
    onValueChange,
    options,
    placeholder = 'Select',
    side = 'auto',
    size,
    value,
    ...props
  },
  forwardedRef,
) {
  const generatedId = useId();
  const triggerId = id ?? `select-${generatedId}-trigger`;
  const listboxId = `select-${generatedId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const initialFocusRef = useRef<'selected' | 'first' | 'last'>('selected');
  const [open, setOpen] = useState(false);
  const [uncontrolledValue, setUncontrolledValue] = useState(
    defaultValue ?? '',
  );
  const [position, setPosition] = useState<SelectPosition | null>(null);

  const currentValue = value ?? uncontrolledValue;
  const selectedOption = useMemo(
    () => options.find((option) => option.value === currentValue),
    [currentValue, options],
  );

  const setTriggerRef = (node: HTMLButtonElement | null) => {
    triggerRef.current = node;

    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  };

  const closeAndRestoreFocus = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const selectValue = (nextValue: string) => {
    const option = options.find((item) => item.value === nextValue);
    if (!option || option.disabled) return;

    if (value === undefined) {
      setUncontrolledValue(nextValue);
    }

    onValueChange?.(nextValue);
    closeAndRestoreFocus();
  };

  const focusOption = (mode: 'selected' | 'first' | 'last') => {
    const content = contentRef.current;
    if (!content) return;

    const items = Array.from(
      content.querySelectorAll<HTMLElement>(
        '[data-select-option]:not([aria-disabled="true"])',
      ),
    );

    if (items.length === 0) return;

    if (mode === 'last') {
      items.at(-1)?.focus();
      return;
    }

    if (mode === 'selected' && currentValue) {
      const selected = items.find(
        (item) => item.dataset.value === currentValue,
      );
      if (selected) {
        selected.focus();
        return;
      }
    }

    items[0]?.focus();
  };

  const updatePosition = () => {
    const trigger = triggerRef.current;
    const content = contentRef.current;
    if (!trigger || !content) return;

    const triggerRect = trigger.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const availableTop = triggerRect.top - VIEWPORT_PADDING;
    const availableBottom =
      window.innerHeight - triggerRect.bottom - VIEWPORT_PADDING;

    const resolvedSide =
      side === 'auto'
        ? availableBottom >= Math.min(contentRect.height, 240) ||
          availableBottom >= availableTop
          ? 'bottom'
          : 'top'
        : side;

    const availableHeight =
      resolvedSide === 'bottom' ? availableBottom : availableTop;
    const maxHeight = Math.max(
      MIN_CONTENT_HEIGHT,
      availableHeight - CONTENT_GAP,
    );
    const renderedHeight = Math.min(contentRect.height, maxHeight);

    let left = triggerRect.left;
    if (align === 'center') {
      left =
        triggerRect.left + triggerRect.width / 2 - contentRect.width / 2;
    } else if (align === 'end') {
      left = triggerRect.right - contentRect.width;
    }

    left = Math.min(
      Math.max(left, VIEWPORT_PADDING),
      window.innerWidth - contentRect.width - VIEWPORT_PADDING,
    );

    const top =
      resolvedSide === 'bottom'
        ? triggerRect.bottom + CONTENT_GAP
        : triggerRect.top - renderedHeight - CONTENT_GAP;

    setPosition({
      top: Math.max(VIEWPORT_PADDING, top),
      left,
      maxHeight,
      side: resolvedSide,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    updatePosition();
  }, [align, open, options, side]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (
        triggerRef.current?.contains(target) ||
        contentRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeAndRestoreFocus();
    };

    const handleReposition = () => {
      updatePosition();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    requestAnimationFrame(() => {
      updatePosition();
      focusOption(initialFocusRef.current);
    });

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open]);

  const openSelect = (initialFocus: 'selected' | 'first' | 'last') => {
    if (disabled) return;
    initialFocusRef.current = initialFocus;
    setOpen(true);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openSelect('selected');
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      openSelect('last');
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open ? closeAndRestoreFocus() : openSelect('selected');
    }
  };

  const handleContentKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      contentRef.current?.querySelectorAll<HTMLElement>(
        '[data-select-option]:not([aria-disabled="true"])',
      ) ?? [],
    );

    if (items.length === 0) return;

    const activeIndex = items.indexOf(document.activeElement as HTMLElement);

    let nextIndex: number | null = null;

    if (event.key === 'ArrowDown') {
      nextIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % items.length;
    } else if (event.key === 'ArrowUp') {
      nextIndex =
        activeIndex < 0
          ? items.length - 1
          : (activeIndex - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = items.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      items[nextIndex]?.focus();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      const active = document.activeElement as HTMLElement | null;
      const nextValue = active?.dataset.value;
      if (!nextValue) return;

      event.preventDefault();
      selectValue(nextValue);
    }
  };

  const menu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={contentRef}
            data-allow-shadow="true"
            data-side={position?.side}
            className={cx(
              'fixed z-50 min-w-48 max-w-80 overflow-hidden rounded-xl border border-border bg-surface p-1 text-foreground shadow-lg outline-none',
              contentClassName,
            )}
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              maxHeight: position?.maxHeight,
              visibility: position ? 'visible' : 'hidden',
            }}
          >
            <div
              id={listboxId}
              role="listbox"
              aria-labelledby={triggerId}
              className="overflow-y-auto"
              style={{
                maxHeight: footer
                  ? `calc(${position?.maxHeight ?? 240}px - 37px)`
                  : position?.maxHeight,
              }}
              onKeyDown={handleContentKeyDown}
            >
              {options.map((option) => {
                const selected = option.value === currentValue;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-disabled={option.disabled || undefined}
                    disabled={option.disabled}
                    data-select-option=""
                    data-value={option.value}
                    className={cx(
                      'relative flex min-h-8 w-full cursor-pointer items-start rounded-lg px-2 py-2 pr-8 text-left text-sm outline-none transition-colors',
                      'hover:bg-surface-hover focus:bg-surface-hover',
                      'disabled:pointer-events-none disabled:opacity-40',
                    )}
                    onClick={() => selectValue(option.value)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-foreground">
                        {option.label}
                      </span>
                      {option.description && (
                        <span className="mt-0.5 block text-xs leading-4 text-foreground-muted">
                          {option.description}
                        </span>
                      )}
                    </span>

                    {selected && (
                      <span className="absolute right-2 top-2.5 flex size-4 items-center justify-center text-foreground-muted">
                        <CheckIcon />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {footer && (
              <>
                <div
                  role="separator"
                  className="-mx-1 my-1 h-px bg-border"
                />
                <div className="px-2 py-1 text-xs text-foreground-muted">
                  {footer}
                </div>
              </>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        {...props}
        ref={setTriggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        data-allow-shadow="true"
        className={cx(selectTriggerVariants({ size }), className)}
        onClick={() => {
          open ? closeAndRestoreFocus() : openSelect('selected');
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="truncate px-0.5">
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronIcon open={open} />
      </button>

      {menu}
    </>
  );
});

Select.displayName = 'Select';

export { selectTriggerVariants };
