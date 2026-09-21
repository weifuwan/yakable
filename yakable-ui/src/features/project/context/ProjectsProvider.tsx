import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  ProjectService,
  type ProjectSummary,
} from '@/service/project';

import { PROJECT_PAGE_SIZE } from '../constants';

export interface ProjectsState {
  projects: ProjectSummary[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  retryInitial: () => Promise<void>;
  loadMore: () => Promise<void>;
  upsertProject: (project: ProjectSummary) => void;
  markProjectActive: (
    projectId: string,
    sessionId: string,
    updatedAt: string,
  ) => void;
}

const ProjectsContext = createContext<ProjectsState | null>(null);

function mergeProjects(
  current: ProjectSummary[],
  incoming: ProjectSummary[],
) {
  const incomingIds = new Set(incoming.map((project) => project.id));
  return [
    ...current.filter((project) => !incomingIds.has(project.id)),
    ...incoming,
  ];
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingMoreRef = useRef(false);

  const loadInitial = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const page = await ProjectService.queryProject(
        {
          current: 1,
          pageSize: PROJECT_PAGE_SIZE,
        },
        signal,
      );
      if (signal?.aborted) return;

      setProjects(page.records);
      setCurrentPage(page.current);
      setHasMore(page.current < page.pages);
    } catch (requestError) {
      if (signal?.aborted) return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load projects.',
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadInitial(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadInitial]);

  const retryInitial = useCallback(
    () => loadInitial(),
    [loadInitial],
  );

  const upsertProject = useCallback((project: ProjectSummary) => {
    setProjects((current) => [
      project,
      ...current.filter((item) => item.id !== project.id),
    ]);
    setError(null);
  }, []);

  const markProjectActive = useCallback(
    (projectId: string, sessionId: string, updatedAt: string) => {
      setProjects((current) => {
        const project = current.find((item) => item.id === projectId);
        if (!project) return current;

        const activeProject: ProjectSummary = {
          ...project,
          latestSessionId: sessionId,
          updatedAt,
        };

        return [
          activeProject,
          ...current.filter((item) => item.id !== projectId),
        ];
      });
    },
    [],
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current) return;

    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    setError(null);

    try {
      const page = await ProjectService.queryProject({
        current: currentPage + 1,
        pageSize: PROJECT_PAGE_SIZE,
      });
      setProjects((current) => mergeProjects(current, page.records));
      setCurrentPage(page.current);
      setHasMore(page.current < page.pages);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load more projects.',
      );
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [currentPage, hasMore]);

  return (
    <ProjectsContext.Provider
      value={{
        projects,
        isLoading,
        isLoadingMore,
        hasMore,
        error,
        retryInitial,
        loadMore,
        upsertProject,
        markProjectActive,
      }}
    >
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
