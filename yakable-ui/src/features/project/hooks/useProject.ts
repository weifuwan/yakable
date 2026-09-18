import { useEffect, useState } from 'react';

import { isAbortError } from '@/shared/api';

import { getProject } from '../api/project-api';
import type { ProjectDetails } from '../types';

export interface ProjectState {
  project: ProjectDetails | null;
  isLoading: boolean;
  error: string | null;
}

export function useProject(projectId: string): ProjectState {
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    void getProject(projectId, controller.signal)
      .then((result) => {
        setProject(result);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (isAbortError(requestError, controller.signal)) return;

        setProject(null);
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load project.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [projectId]);

  return { project, isLoading, error };
}
