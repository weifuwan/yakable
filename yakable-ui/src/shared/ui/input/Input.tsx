import type { InputHTMLAttributes } from 'react';

import { cx } from '../cx';

export type InputSize = 'sm' | 'md';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  sizeVariant?: InputSize;
}

const sizes: Record<InputSize, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-9 px-3 text-sm',
};

export function Input({
  className,
  sizeVariant = 'md',
  ...props
}: InputProps) {
  return (
    <input
      className={cx(
        'w-full rounded-lg border border-black/[0.12] bg-white text-[#20201e] outline-none transition-colors placeholder:text-black/35 focus:border-black/30 focus:ring-2 focus:ring-black/[0.08] disabled:cursor-not-allowed disabled:bg-black/[0.03] disabled:text-black/40 aria-[invalid=true]:border-red-500/70 aria-[invalid=true]:focus:ring-red-500/10',
        sizes[sizeVariant],
        className,
      )}
      {...props}
    />
  );
}
