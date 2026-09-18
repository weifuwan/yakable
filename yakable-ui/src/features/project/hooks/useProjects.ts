import { useEffect, useState } from 'react';

import { isAbortError } from '@/shared/api';

import { getProjects } from '../api/project-api';
import type { ProjectSummary } from '../types';

export interface ProjectsState {
  projects: ProjectSummary[];
  isLoading: boolean;
  error: string | null;
}

export function useProjects(): ProjectsState {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void getProjects(controller.signal)
      .then((result) => {
        setProjects(result);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (isAbortError(requestError, controller.signal)) return;

        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load projects.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, []);

  return {
    projects,
    isLoading,
    error,
  };
}
