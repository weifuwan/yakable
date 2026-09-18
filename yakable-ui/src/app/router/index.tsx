import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { DashboardPage } from '@/pages/dashboard';
import { WorkspacePage } from '@/pages/workspace';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard/*" element={<DashboardPage />} />
      <Route path="/projects/:projectId/*" element={<WorkspacePage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
