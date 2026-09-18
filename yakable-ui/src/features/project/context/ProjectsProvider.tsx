import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { isAbortError } from '@/shared/api';

import { getProjects } from '../api/project-api';
import type { ProjectSummary } from '../types';

export interface ProjectsState {
  projects: ProjectSummary[];
  isLoading: boolean;
  error: string | null;
}

const ProjectsContext = createContext<ProjectsState | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
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

  return (
    <ProjectsContext.Provider value={{ projects, isLoading, error }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjectsContext(): ProjectsState {
  const value = useContext(ProjectsContext);

  if (!value) {
    throw new Error('useProjects must be used within ProjectsProvider.');
  }

  return value;
}
