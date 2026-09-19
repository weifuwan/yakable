import { Navigate, useParams } from 'react-router-dom';

import { SessionWorkspace } from '@/features/session';

export function ProjectPage() {
  const { projectId, sessionId } = useParams<{
    projectId: string;
    sessionId: string;
  }>();

  if (!projectId || !sessionId) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <SessionWorkspace
      projectId={projectId}
      sessionId={sessionId}
    />
  );
}
