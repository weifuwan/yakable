import { Link } from 'react-router-dom';

import type { ProjectSummary } from '../types';

export function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <Link
      to={'/projects/' + encodeURIComponent(project.id)}
      className="block rounded-xl border border-black/[0.08] bg-white p-4 text-inherit no-underline transition-colors hover:bg-black/[0.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/50"
    >
      <h3 className="m-0 truncate text-sm font-semibold">{project.name}</h3>
      <p className="mb-0 mt-2 text-xs text-black/45">
        Updated {new Date(project.updatedAt).toLocaleString()}
      </p>
    </Link>
  );
}
