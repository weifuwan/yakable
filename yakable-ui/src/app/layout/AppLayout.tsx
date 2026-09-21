import { Outlet } from 'react-router-dom';

import { Sidebar } from '@/app/navigation/sidebar';
import { ProjectsProvider } from '@/features/project';

export function AppLayout() {
  return (
    <ProjectsProvider>
      <div className="flex h-full min-h-0 overflow-hidden bg-background text-foreground">
        <Sidebar />

        <div className="min-h-0 min-w-0 flex-1 p-2">
          <main className="h-full min-h-0 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface">
            <Outlet />
          </main>
        </div>
      </div>
    </ProjectsProvider>
  );
}
