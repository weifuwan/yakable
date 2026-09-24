import type { Button as BaseButtonNS } from '@base-ui/react/button';
import { Button as BaseButton } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';

import { cx } from '../cx';

export const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring-strong data-disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary-hover disabled:bg-surface-skeleton disabled:text-foreground-disabled',
        secondary:
          'border border-border-control bg-surface text-foreground hover:bg-surface-hover-subtle disabled:opacity-40',
        ghost: 'bg-transparent text-foreground hover:bg-surface-hover disabled:opacity-40',
        destructive: 'bg-danger text-primary-foreground hover:bg-danger/90 disabled:opacity-40',
        accent:
          'bg-action-active text-primary-foreground hover:bg-action-active disabled:bg-surface-skeleton disabled:text-foreground-disabled',
        link: 'bg-transparent text-foreground underline-offset-4 hover:underline disabled:opacity-40',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-9 px-3.5 text-sm',
        lg: 'h-10 px-5 text-sm',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
      shape: {
        default: 'rounded-lg',
        circle: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
      shape: 'default',
    },
  },
);

type BaseButtonProps = Omit<
  BaseButtonNS.Props,
  'className' | 'nativeButton' | 'ref' | 'render'
>;

export type ButtonProps = BaseButtonProps &
  VariantProps<typeof buttonVariants> & {
    className?: string;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, type = 'button', variant, size, shape, ...props },
  ref,
) {
  return (
    <BaseButton
      ref={ref}
      type={type}
      className={cx(buttonVariants({ variant, size, shape }), className)}
      {...props}
    />
  );
});

Button.displayName = 'Button';
