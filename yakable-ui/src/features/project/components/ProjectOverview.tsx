import { useProject } from '../hooks/useProject';

export function ProjectOverview({ projectId }: { projectId: string }) {
  const { project, isLoading, error } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="px-8 py-10 text-sm text-black/45" role="status">
        Loading project...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10" role="alert">
        <h1 className="m-0 text-xl font-semibold">Project unavailable</h1>
        <p className="mb-0 mt-2 text-sm text-black/45">
          {error ?? 'Unable to load project.'}
        </p>
      </div>
    );
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-8 py-10">
      <div className="border-b border-black/[0.08] pb-6">
        <p className="m-0 text-xs font-medium uppercase tracking-[0.08em] text-black/35">
          Project
        </p>
        <h1 className="mb-0 mt-2 text-2xl font-semibold tracking-[-0.025em]">
          {project.name}
        </h1>
        <p className="mb-0 mt-2 text-xs text-black/40">{project.id}</p>
      </div>

      <div className="grid gap-6 py-6 md:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <h2 className="m-0 text-sm font-semibold">Initial prompt</h2>
          <p className="mb-0 mt-3 whitespace-pre-wrap text-sm leading-6 text-black/65">
            {project.prompt}
          </p>
        </div>

        <dl className="m-0 space-y-4 text-sm">
          <div>
            <dt className="text-xs text-black/40">Status</dt>
            <dd className="m-0 mt-1 font-medium">Created</dd>
          </div>
          <div>
            <dt className="text-xs text-black/40">Model</dt>
            <dd className="m-0 mt-1 font-medium">
              {project.model.provider} / {project.model.model}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-dashed border-black/[0.12] px-5 py-4 text-sm text-black/45">
        Project created. Generation will be added as the next product slice.
      </div>
    </section>
  );
}
