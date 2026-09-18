import { Navigate, useParams } from 'react-router-dom';

import { ProjectOverview } from '@/features/project';

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();

  if (!projectId) {
    return <Navigate to="/dashboard" replace />;
  }

  return <ProjectOverview projectId={projectId} />;
}
