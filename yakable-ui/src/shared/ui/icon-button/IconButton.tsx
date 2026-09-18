import type { ButtonHTMLAttributes, ReactNode } from 'react';

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

export function IconButton({
  children,
  className,
  variant = 'ghost',
  size = 'md',
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
