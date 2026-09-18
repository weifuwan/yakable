import { Outlet } from 'react-router-dom';

import { Sidebar } from '@/app/navigation/sidebar';

export function AppLayout() {
  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-[#f6f6f4] text-[#20201e]">
      <Sidebar />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-white">
        <Outlet />
      </main>
    </div>
  );
}
