import { useCallback } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { useProjects } from '@/features/project';
import { SessionWorkspace } from '@/features/session';

export function ProjectPage() {
  const { projectId, sessionId } = useParams<{
    projectId: string;
    sessionId: string;
  }>();
  const { markProjectActive } = useProjects();

  const handleSessionActivity = useCallback(
    (activeSessionId: string, updatedAt: string) => {
      if (!projectId) return;
      markProjectActive(projectId, activeSessionId, updatedAt);
    },
    [markProjectActive, projectId],
  );

  if (!projectId || !sessionId) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <SessionWorkspace
      projectId={projectId}
      sessionId={sessionId}
      onActivity={handleSessionActivity}
    />
  );
}
