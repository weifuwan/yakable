import type {
  CreateProjectInput,
  ProjectDetails,
  ProjectSummary,
} from '../types';

function isProjectSummary(value: unknown): value is ProjectSummary {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const project = value as Record<string, unknown>;
  return (
    typeof project.id === 'string' &&
    typeof project.name === 'string' &&
    typeof project.sessionId === 'string' &&
    typeof project.updatedAt === 'string'
  );
}

function isProjectDetails(value: unknown): value is ProjectDetails {
  if (!isProjectSummary(value)) return false;

  const project = value as unknown as Record<string, unknown>;
  return (
    project.status === 'CREATED' &&
    typeof project.createdAt === 'string'
  );
}

async function readJson(response: Response, errorMessage: string) {
  try {
    return await response.json() as unknown;
  } catch (error) {
    throw new Error(errorMessage, { cause: error });
  }
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

  const data = await readJson(response, 'Project API returned invalid JSON.');

  if (!Array.isArray(data) || !data.every(isProjectSummary)) {
    throw new Error('Project API returned an invalid response.');
  }

  return data;
}

export async function getProject(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectDetails> {
  let response: Response;

  try {
    response = await fetch('/api/projects/' + encodeURIComponent(projectId), {
      headers: {
        Accept: 'application/json',
      },
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Unable to load project.', { cause: error });
  }

  if (!response.ok) {
    throw new Error('Unable to load project (HTTP ' + response.status + ').');
  }

  const data = await readJson(response, 'Project API returned invalid JSON.');

  if (!isProjectDetails(data)) {
    throw new Error('Project API returned an invalid project.');
  }

  return data;
}

export async function createProject(
  input: CreateProjectInput,
  signal?: AbortSignal,
): Promise<ProjectDetails> {
  let response: Response;

  try {
    response = await fetch('/api/projects', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Unable to create project.', { cause: error });
  }

  if (!response.ok) {
    throw new Error('Unable to create project (HTTP ' + response.status + ').');
  }

  const data = await readJson(response, 'Project API returned invalid JSON.');

  if (!isProjectDetails(data)) {
    throw new Error('Project API returned an invalid project.');
  }

  return data;
}
