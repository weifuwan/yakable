import * as React from 'react';

import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'muted';
}

const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'border-transparent bg-primary text-primary-foreground',
  outline: 'border-border bg-background text-foreground',
  muted: 'border-transparent bg-muted text-foreground',
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
);
Badge.displayName = 'Badge';
