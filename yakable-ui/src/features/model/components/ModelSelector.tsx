import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import { Icon, cx } from '@/shared/ui';

import { MODEL_CATALOG } from '../catalog';
import type { ModelOption, ModelSelection } from '../types';

function isSameModel(left: ModelSelection, right: ModelSelection) {
  return left.provider === right.provider && left.model === right.model;
}

function findSelectedModel(
  models: readonly ModelOption[],
  value: ModelSelection,
) {
  return models.find((model) => isSameModel(model, value));
}

export function ModelSelector({
  models = MODEL_CATALOG,
  onValueChange,
  value,
}: {
  models?: readonly ModelOption[];
  onValueChange: (value: ModelSelection) => void;
  value: ModelSelection;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selectedModel = findSelectedModel(models, value);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        rootRef.current?.contains(event.target)
      ) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !open) return;

    event.preventDefault();
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label="Select model"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 max-w-40 cursor-pointer items-center gap-1 rounded-lg px-2 text-sm font-medium text-black/60 outline-none hover:bg-black/[0.05] hover:text-[#20201e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/50"
      >
        <span className="truncate">{selectedModel?.label ?? 'Select model'}</span>
        <Icon size={14} viewBox="0 0 20 20" strokeWidth={1.6}>
          <path d="m6 8 4 4 4-4" />
        </Icon>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Models"
          className="absolute top-full right-0 z-30 mt-2 w-44 rounded-xl border border-black/[0.10] bg-white p-1"
        >
          {models.map((model) => {
            const selected = isSameModel(model, value);

            return (
              <button
                key={`${model.provider}:${model.model}`}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onValueChange({
                    provider: model.provider,
                    model: model.model,
                  });
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className={cx(
                  'flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 text-left text-sm outline-none',
                  selected
                    ? 'bg-black/[0.06] font-medium text-[#20201e]'
                    : 'text-black/65 hover:bg-black/[0.04] hover:text-[#20201e]',
                  'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-black/40',
                )}
              >
                <span className="truncate">{model.label}</span>
                {selected && (
                  <Icon size={15} viewBox="0 0 20 20" strokeWidth={1.7}>
                    <path d="m5 10 3 3 7-7" />
                  </Icon>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
