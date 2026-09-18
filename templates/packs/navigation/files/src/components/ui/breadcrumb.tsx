import * as React from 'react';

import { cn } from '@/lib/utils';

export const Breadcrumb = React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<'nav'>>(
  ({ ...props }, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />,
);
Breadcrumb.displayName = 'Breadcrumb';

export const BreadcrumbList = React.forwardRef<HTMLOListElement, React.OlHTMLAttributes<HTMLOListElement>>(
  ({ className, ...props }, ref) => (
    <ol
      ref={ref}
      className={cn('m-0 flex list-none flex-wrap items-center gap-2 p-0 text-sm text-muted-foreground', className)}
      {...props}
    />
  ),
);
BreadcrumbList.displayName = 'BreadcrumbList';

export const BreadcrumbItem = React.forwardRef<HTMLLIElement, React.LiHTMLAttributes<HTMLLIElement>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn('inline-flex items-center gap-2', className)} {...props} />
  ),
);
BreadcrumbItem.displayName = 'BreadcrumbItem';

export const BreadcrumbLink = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ className, ...props }, ref) => (
    <a ref={ref} className={cn('text-muted-foreground no-underline hover:text-foreground', className)} {...props} />
  ),
);
BreadcrumbLink.displayName = 'BreadcrumbLink';

export const BreadcrumbPage = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span ref={ref} aria-current="page" className={cn('font-medium text-foreground', className)} {...props} />
  ),
);
BreadcrumbPage.displayName = 'BreadcrumbPage';

export function BreadcrumbSeparator({ className, children = '/', ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span aria-hidden="true" className={cn('text-muted-foreground/70', className)} {...props}>
      {children}
    </span>
  );
}
