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
  loadMore: () => Promise<void>;
  upsertProject: (project: ProjectSummary) => void;
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

  const upsertProject = useCallback((project: ProjectSummary) => {
    setProjects((current) => [
      project,
      ...current.filter((item) => item.id !== project.id),
    ]);
    setError(null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void ProjectService.queryProjectPage(
      {
        current: 1,
        pageSize: PROJECT_PAGE_SIZE,
      },
      controller.signal,
    )
      .then((page) => {
        setProjects((current) => {
          const serverIds = new Set(
            page.records.map((project) => project.id),
          );
          const locallyCreated = current.filter(
            (project) => !serverIds.has(project.id),
          );
          return [...locallyCreated, ...page.records];
        });
        setCurrentPage(page.current);
        setHasMore(page.current < page.pages);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
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

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current) return;

    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    setError(null);

    try {
      const page = await ProjectService.queryProjectPage({
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
        loadMore,
        upsertProject,
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
