import {
  announceUserEditMessageSubmitted,
  buildVisualEditPrompt,
  clearCurrentPreviewSelections,
  getCurrentPreviewSelections,
  type PreviewSelection,
} from './visual-edit-context';

export type ProjectTemplate = 'website' | 'app';

export interface ProjectRoute {
  path: string;
  title: string;
}

export interface ProjectEditHistoryItem {
  id: string;
  createdAt: string;
  userRequest: string;
  assistantSummary: string;
  changedFiles: string[];
}

export interface ProjectSession {
  version: 1;
  productRequest?: string;
  designIntent?: unknown;
  initialSummary?: string;
  createdAt: string;
  updatedAt: string;
  edits: ProjectEditHistoryItem[];
}

export interface ProjectListItem {
  id: string;
  name: string;
  updatedAt: string;
  createdAt?: string;
  starred: boolean;
  template: ProjectTemplate;
  remixedFrom?: string;
}

export interface CreatedProject {
  project: {
    id: string;
    name: string;
    summary: string;
    model: string;
    template: ProjectTemplate;
    routes: ProjectRoute[];
    session: ProjectSession | null;
  };
  previewUrl: string;
}

export interface RuntimeProject {
  projectId: string;
  name: string;
  starred: boolean;
  previewUrl: string;
  template: ProjectTemplate;
  routes: ProjectRoute[];
  session: ProjectSession | null;
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

export async function editProject(
  projectId: string,
  prompt: string,
  selections: PreviewSelection[] = getCurrentPreviewSelections(),
): Promise<EditedProject> {
  announceUserEditMessageSubmitted(prompt, selections);
  const visualEditPrompt = buildVisualEditPrompt(prompt, selections);
  const result = await requestJson<EditedProject>(
    `/api/projects/${encodeURIComponent(projectId)}/edit`,
    {
      method: 'POST',
      body: JSON.stringify({ prompt: visualEditPrompt }),
    },
  );

  if (selections.length) {
    clearCurrentPreviewSelections();
  }
  return result;
}

export async function updateProject(
  projectId: string,
  patch: { name?: string; starred?: boolean },
): Promise<ProjectListItem> {
  const result = await requestJson<{ project: ProjectListItem }>(
    `/api/projects/${encodeURIComponent(projectId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  );
  return result.project;
}

export async function remixProject(projectId: string): Promise<ProjectListItem> {
  const result = await requestJson<{ project: ProjectListItem }>(
    `/api/projects/${encodeURIComponent(projectId)}/remix`,
    {
      method: 'POST',
      body: '{}',
    },
  );
  return result.project;
}

export async function deleteProject(projectId: string): Promise<void> {
  await requestJson<{ ok: true; projectId: string }>(
    `/api/projects/${encodeURIComponent(projectId)}`,
    { method: 'DELETE' },
  );
}
