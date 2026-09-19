import { Navigate, useParams } from 'react-router-dom';

import { GenerationWorkspace } from '@/features/generation';
import { useProject } from '@/features/project';

function ProjectRoute({ projectId }: { projectId: string }) {
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
    <GenerationWorkspace
      projectId={project.id}
      projectName={project.name}
      prompt={project.prompt}
      provider={project.model.provider}
      model={project.model.model}
    />
  );
}

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();

  if (!projectId) {
    return <Navigate to="/dashboard" replace />;
  }

  return <ProjectRoute projectId={projectId} />;
}
