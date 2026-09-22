import { Link } from 'react-router-dom';

import { Icon, cx } from '@/shared/ui';

import type { SidebarRoute, SidebarRouteIcon } from './routes';

function SidebarRouteIconView({ icon }: { icon: SidebarRouteIcon }) {
  if (icon === 'dashboard') {
    return (
      <Icon size={17}>
        <path d="M4 10.5 12 4l8 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" />
        <path d="M9 20v-6h6v6" />
      </Icon>
    );
  }

  return null;
}

export function SidebarNavItem({ pathname, route }: { pathname: string; route: SidebarRoute }) {
  const active = route.active(pathname);

  return (
    <Link
      to={route.href}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex h-8 items-center gap-2 rounded-lg px-2 text-sm font-medium text-foreground-secondary no-underline transition-colors',
        active
          ? 'bg-surface-selected text-foreground'
          : 'hover:bg-navigation-hover hover:text-foreground',
      )}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        <SidebarRouteIconView icon={route.icon} />
      </span>
      <span className="truncate">{route.label}</span>
    </Link>
  );
}
