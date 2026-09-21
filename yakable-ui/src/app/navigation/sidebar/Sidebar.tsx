import { useLocation } from 'react-router-dom';

import { RecentProjects } from '@/features/project';

import { SIDEBAR_ROUTES } from './routes';
import { SidebarNavItem } from './SidebarNavItem';

const logoUrl = new URL('../../../assets/logo.png', import.meta.url).href;

export function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-[#f4f4f2]">
      <div className="flex h-14 shrink-0 items-center gap-2 px-3">
        <img
          src={logoUrl}
          alt=""
          aria-hidden="true"
          className="size-6 shrink-0 rounded-md object-contain"
        />
        <span className="truncate text-sm font-semibold tracking-[-0.01em]">
          Yakable
        </span>
      </div>

      <nav aria-label="Primary navigation" className="px-2">
        {SIDEBAR_ROUTES.map((route) => (
          <SidebarNavItem key={route.key} route={route} pathname={pathname} />
        ))}
      </nav>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <RecentProjects />
      </div>
    </aside>
  );
}
