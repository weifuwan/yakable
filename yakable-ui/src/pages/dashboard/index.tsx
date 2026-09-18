import { AppShell } from '@/app/layout/Layout';
import { ProjectList } from '@/features/project';

export function DashboardPage() {
  return (
    <AppShell>
      <ProjectList />
    </AppShell>
  );
}

export { DashboardPage as Dashboard };
