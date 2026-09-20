import {
  useEffect,
  useRef,
} from 'react';
import { Link, useParams } from 'react-router-dom';

import type { ProjectSummary } from '@/service/project';
import { cx } from '@/shared/ui';

import {
  PROJECT_LOAD_MORE_SKELETON_ROWS,
  PROJECT_PAGE_SIZE,
} from '../constants';
import { useProjects } from '../hooks/useProjects';

function projectHref(project: ProjectSummary): string {
  return (
    '/dashboard/project/' +
    encodeURIComponent(project.id) +
    '/session/' +
    encodeURIComponent(project.latestSessionId)
  );
}

function ProjectSkeletonRows({
  count,
  testId,
}: {
  count: number;
  testId: string;
}) {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-0.5"
      data-testid={testId}
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex h-8 items-center px-2"
        >
          <div className="h-3 w-full animate-pulse rounded-full bg-black/[0.08]" />
        </div>
      ))}
    </div>
  );
}

export function RecentProjects() {
  const { projectId: activeProjectId } = useParams<{
    projectId: string;
  }>();
  const {
    projects,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
  } = useProjects();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (
      !target ||
      !hasMore ||
      isLoadingMore ||
      error ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: '0px 0px 96px 0px' },
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [error, hasMore, isLoadingMore, loadMore]);

  return (
    <section aria-labelledby="recent-projects-heading">
      <h2
        id="recent-projects-heading"
        className="mb-1.5 px-2 text-xs font-medium text-black/45"
      >
        Recents
      </h2>

      {projects.length === 0 && isLoading && (
        <div role="status">
          <span className="sr-only">Loading recent projects</span>
          <ProjectSkeletonRows
            count={PROJECT_PAGE_SIZE}
            testId="recent-projects-skeleton"
          />
        </div>
      )}

      {projects.length === 0 && !isLoading && error && (
        <p className="m-0 px-2 py-1 text-xs leading-5 text-black/35">
          Recent projects unavailable
        </p>
      )}

      {projects.length === 0 && !isLoading && !error && (
        <p className="m-0 px-2 py-1 text-xs text-black/35">
          No recent projects
        </p>
      )}

      {projects.length > 0 && (
        <>
          <nav aria-label="Recent projects" className="flex flex-col gap-0.5">
            {projects.map((project) => {
              const href = projectHref(project);
              const active = project.id === activeProjectId;

              return (
                <Link
                  key={project.id}
                  to={href}
                  aria-current={active ? 'page' : undefined}
                  title={project.name}
                  className={cx(
                    'block h-8 truncate rounded-lg px-2 leading-8 text-sm text-black/65 no-underline transition-colors',
                    active
                      ? 'bg-black/[0.07] font-medium text-[#20201e]'
                      : 'hover:bg-black/[0.045] hover:text-[#20201e]',
                  )}
                >
                  {project.name}
                </Link>
              );
            })}
          </nav>

          {isLoadingMore && (
            <div className="mt-0.5" role="status">
              <span className="sr-only">Loading more recent projects</span>
              <ProjectSkeletonRows
                count={PROJECT_LOAD_MORE_SKELETON_ROWS}
                testId="recent-projects-loading-more"
              />
            </div>
          )}

          {error && hasMore && !isLoadingMore && (
            <div className="px-2 py-2">
              <button
                type="button"
                className="text-xs text-black/45 hover:text-black/65"
                onClick={() => void loadMore()}
              >
                Retry loading more
              </button>
            </div>
          )}

          {hasMore && !error && (
            <div
              ref={loadMoreRef}
              aria-hidden="true"
              className="h-px w-full"
              data-testid="recent-projects-load-more"
            />
          )}
        </>
      )}
    </section>
  );
}
