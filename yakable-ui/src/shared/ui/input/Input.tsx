import {
  forwardRef,
  type InputHTMLAttributes,
} from 'react';

import { cx } from '../cx';

export type InputSize = 'sm' | 'md';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  htmlSize?: number;
}

const sizes: Record<InputSize, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-9 px-3 text-sm',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    size = 'md',
    htmlSize,
    ...props
  },
  ref,
) {
  return (
    <input
      ref={ref}
      size={htmlSize}
      className={cx(
        'w-full rounded-lg border border-black/[0.12] bg-white text-[#20201e] outline-none transition-colors placeholder:text-black/35 focus:border-black/30 focus:outline-2 focus:outline-offset-1 focus:outline-black/20 disabled:cursor-not-allowed disabled:bg-black/[0.03] disabled:text-black/40 aria-[invalid=true]:border-red-500/70 aria-[invalid=true]:focus:outline-red-500/30',
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
