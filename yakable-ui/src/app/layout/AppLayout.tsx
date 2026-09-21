import { Outlet } from 'react-router-dom';

import { Sidebar } from '@/app/navigation/sidebar';
import { ProjectsProvider } from '@/features/project';

export function AppLayout() {
  return (
    <ProjectsProvider>
      <div className="flex h-full min-h-0 overflow-hidden bg-[#f4f4f2] text-[#20201e]">
        <Sidebar />

        <div className="min-h-0 min-w-0 flex-1 p-2">
          <main className="h-full min-h-0 overflow-y-auto overscroll-contain rounded-2xl border border-black/[0.10] bg-white">
            <Outlet />
          </main>
        </div>
      </div>
    </ProjectsProvider>
  );
}
