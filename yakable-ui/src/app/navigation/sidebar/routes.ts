export type SidebarRouteIcon = 'dashboard';

export interface SidebarRoute {
  key: string;
  href: string;
  label: string;
  icon: SidebarRouteIcon;
  active: (pathname: string) => boolean;
}

export const SIDEBAR_ROUTES = [
  {
    key: 'dashboard',
    href: '/dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    active: (pathname: string) =>
      pathname === '/dashboard' || pathname.startsWith('/dashboard/'),
  },
] as const satisfies readonly SidebarRoute[];
