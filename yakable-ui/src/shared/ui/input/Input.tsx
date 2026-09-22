import { forwardRef, type InputHTMLAttributes } from 'react';

import { cx } from '../cx';

export type InputSize = 'sm' | 'md';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  htmlSize?: number;
}

const sizes: Record<InputSize, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-9 px-3 text-sm',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, size = 'md', htmlSize, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      size={htmlSize}
      className={cx(
        'w-full rounded-lg border border-border-control bg-surface text-foreground outline-none transition-colors placeholder:text-foreground-faint focus:border-border-focus focus:outline-2 focus:outline-offset-1 focus:outline-focus-ring-soft disabled:cursor-not-allowed disabled:bg-surface-hover-subtle disabled:text-foreground-subtle aria-[invalid=true]:border-danger-border aria-[invalid=true]:focus:outline-danger-ring',
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
