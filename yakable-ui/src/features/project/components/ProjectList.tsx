import { ProjectCard } from './ProjectCard';
import { useProjects } from '../hooks/useProjects';

export function ProjectList() {
  const {
    projects,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
  } = useProjects();

  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-10">
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-[-0.025em]">
          Projects
        </h1>
        <p className="mb-0 mt-2 text-sm leading-6 text-black/45">
          Continue working on an existing Yakable project.
        </p>
      </div>

      <div className="mt-8">
        {isLoading && (
          <p className="m-0 text-sm text-black/45" role="status">
            Loading projects...
          </p>
        )}

        {!isLoading && error && projects.length === 0 && (
          <div
            className="rounded-xl border border-black/[0.08] bg-white p-5"
            role="alert"
          >
            <h2 className="m-0 text-sm font-semibold">Projects unavailable</h2>
            <p className="mb-0 mt-2 text-sm leading-6 text-black/45">{error}</p>
          </div>
        )}

        {!isLoading && projects.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-black/[0.12] bg-white/60 px-6 py-12 text-center">
            <h2 className="m-0 text-sm font-semibold">No projects yet</h2>
            <p className="mb-0 mt-2 text-sm leading-6 text-black/45">
              Project creation will be added as a separate product slice.
            </p>
          </div>
        )}

        {!isLoading && projects.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>

            {error && (
              <p className="mb-0 mt-4 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  disabled={isLoadingMore}
                  onClick={() => void loadMore()}
                  className="h-9 rounded-lg border border-black/[0.1] bg-white px-4 text-sm text-black/65 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
