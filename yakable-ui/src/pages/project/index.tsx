import { useCallback } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { ProjectFilesBrowser, useProjects } from '@/features/project';
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
    <div className="flex h-full min-h-0 min-w-0 overflow-hidden">
      <div className="min-h-0 min-w-0 flex-1">
        <SessionWorkspace
          projectId={projectId}
          sessionId={sessionId}
          onActivity={handleSessionActivity}
        />
      </div>

      <div className="min-h-0 w-[46%] min-w-[420px] max-w-[760px] border-l border-border">
        <ProjectFilesBrowser projectId={projectId} />
      </div>
    </div>
  );
}
