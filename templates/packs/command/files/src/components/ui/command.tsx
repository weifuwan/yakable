import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';

import { cn } from '@/lib/utils';

export function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn('flex w-full flex-col overflow-hidden rounded-md bg-background text-foreground', className)}
      {...props}
    />
  );
}

export function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <CommandPrimitive.Input
      className={cn('h-11 w-full border-0 border-b border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground', className)}
      {...props}
    />
  );
}

export function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn('max-h-72 overflow-y-auto overflow-x-hidden p-1', className)}
      {...props}
    />
  );
}

export function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className={cn('py-6 text-center text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn('overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground', className)}
      {...props}
    />
  );
}

export function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn('relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-muted data-[disabled=true]:opacity-50', className)}
      {...props}
    />
  );
}

export function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      className={cn('-mx-1 h-px bg-border', className)}
      {...props}
    />
  );
}

export function CommandShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)}
      {...props}
    />
  );
}
