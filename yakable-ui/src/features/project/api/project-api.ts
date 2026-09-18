import type { ProjectSummary } from '../types';

function isProjectSummary(value: unknown): value is ProjectSummary {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const project = value as Record<string, unknown>;
  return (
    typeof project.id === 'string'
    && typeof project.name === 'string'
    && typeof project.updatedAt === 'string'
  );
}

export async function getProjects(
  signal?: AbortSignal,
): Promise<ProjectSummary[]> {
  let response: Response;

  try {
    response = await fetch('/api/projects', {
      headers: {
        Accept: 'application/json',
      },
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Unable to load projects.', { cause: error });
  }

  if (!response.ok) {
    throw new Error('Unable to load projects (HTTP ' + response.status + ').');
  }

  let data: unknown;
  try {
    data = await response.json() as unknown;
  } catch (error) {
    throw new Error('Project API returned invalid JSON.', { cause: error });
  }

  if (!Array.isArray(data) || !data.every(isProjectSummary)) {
    throw new Error('Project API returned an invalid response.');
  }

  return data;
}
