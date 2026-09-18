import { DashboardPage } from '@/pages/dashboard';
import { WorkspacePage } from '@/pages/workspace';

function currentPath(): string {
  return window.location.pathname || '/';
}

export default function App() {
  const pathname = currentPath();

  if (pathname.startsWith('/projects/')) {
    return <WorkspacePage />;
  }

  return <DashboardPage />;
}
