import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { ProjectSummary } from '@/service/project';
import { cx } from '@/shared/ui';

import { useProjects } from '../hooks/useProjects';

const DEFAULT_RECENT_LIMIT = 5;

function updatedAtTimestamp(project: ProjectSummary): number {
  const timestamp = Date.parse(project.updatedAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function projectHref(project: ProjectSummary): string {
  return (
    '/dashboard/project/' +
    encodeURIComponent(project.id) +
    '/session/' +
    encodeURIComponent(project.latestSessionId)
  );
}

export function RecentProjects({
  limit = DEFAULT_RECENT_LIMIT,
}: {
  limit?: number;
}) {
  const { projectId: activeProjectId } = useParams<{
    projectId: string;
  }>();
  const { projects, isLoading, error } = useProjects();

  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort((left, right) => updatedAtTimestamp(right) - updatedAtTimestamp(left))
        .slice(0, limit),
    [limit, projects],
  );

  return (
    <section aria-labelledby="recent-projects-heading">
      <h2
        id="recent-projects-heading"
        className="mb-1.5 px-2 text-xs font-medium text-black/45"
      >
        Recents
      </h2>

      {recentProjects.length === 0 && isLoading && (
        <p className="m-0 px-2 py-1 text-xs text-black/35" role="status">
          Loading...
        </p>
      )}

      {recentProjects.length === 0 && !isLoading && error && (
        <p className="m-0 px-2 py-1 text-xs leading-5 text-black/35">
          Recent projects unavailable
        </p>
      )}

      {recentProjects.length === 0 && !isLoading && !error && (
        <p className="m-0 px-2 py-1 text-xs text-black/35">
          No recent projects
        </p>
      )}

      {recentProjects.length > 0 && (
        <nav aria-label="Recent projects" className="flex flex-col gap-0.5">
          {recentProjects.map((project) => {
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
      )}
    </section>
  );
}
