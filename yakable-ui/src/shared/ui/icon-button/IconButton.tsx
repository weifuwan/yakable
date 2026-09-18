import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';

import { cx } from '../cx';

export type IconButtonVariant = 'secondary' | 'ghost';
export type IconButtonSize = 'sm' | 'md';

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  'aria-label': string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

const variants: Record<IconButtonVariant, string> = {
  secondary:
    'border border-black/[0.12] bg-white text-[#20201e] hover:bg-black/[0.03]',
  ghost:
    'bg-transparent text-[#5f6868] hover:bg-black/[0.05] hover:text-[#20201e]',
};

const sizes: Record<IconButtonSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      children,
      className,
      variant = 'ghost',
      size = 'md',
      type = 'button',
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          'inline-flex shrink-0 items-center justify-center rounded-lg outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/50 disabled:pointer-events-none disabled:opacity-40',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
