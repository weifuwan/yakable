export interface ProjectListItem {
  id: string;
  updatedAt: string;
}

export interface CreatedProject {
  project: {
    id: string;
    summary: string;
    model: string;
  };
  previewUrl: string;
}

export interface RuntimeProject {
  projectId: string;
  previewUrl: string;
}

export interface EditedProject extends RuntimeProject {
  summary: string;
  model: string;
  changedFiles: string[];
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(payload.error || `Yakable API failed with HTTP ${response.status}.`);
  }
  return payload;
}

export async function listProjects(): Promise<ProjectListItem[]> {
  const result = await requestJson<{ projects: ProjectListItem[] }>('/api/projects');
  return result.projects;
}

export function createProject(prompt: string): Promise<CreatedProject> {
  return requestJson('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

export function startProjectRuntime(projectId: string): Promise<RuntimeProject> {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}/runtime`, {
    method: 'POST',
    body: '{}',
  });
}

export function editProject(projectId: string, prompt: string): Promise<EditedProject> {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}/edit`, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}
