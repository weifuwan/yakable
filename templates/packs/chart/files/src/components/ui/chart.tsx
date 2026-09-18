import * as React from 'react';
import { ResponsiveContainer } from 'recharts';

import { cn } from '@/lib/utils';

export interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactElement;
  height?: number;
}

export const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ className, children, height = 280, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('w-full', className)}
      style={{ minHeight: height, ...style }}
      {...props}
    >
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  ),
);
ChartContainer.displayName = 'ChartContainer';
