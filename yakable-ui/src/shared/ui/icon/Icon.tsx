import type { SVGProps } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  label?: string;
  size?: number | string;
}

export function Icon({
  children,
  label,
  size = 16,
  viewBox = '0 0 24 24',
  ...props
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...props}
    >
      {children}
    </svg>
  );
}
