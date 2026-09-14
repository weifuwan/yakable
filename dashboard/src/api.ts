import {
  buildVisualEditPrompt,
  clearCurrentPreviewSelections,
  getCurrentPreviewSelections,
  type PreviewSelection,
} from './visual-edit-context';

export type ProjectTemplate = 'website' | 'app';
export type BuildIntentRoute = 'CREATE' | 'CHAT' | 'CLARIFY';
export type BuildIntentConfidence = 'high' | 'medium';

export interface BuildIntentDecision {
  version: 1;
  route: BuildIntentRoute;
  confidence: BuildIntentConfidence;
  message: string;
}

export interface ProjectRoute {
  path: string;
  title: string;
}

export interface PersistedVisualSelection {
  sourceId?: string;
  file?: string;
  line?: number;
  column?: number;
  tagName: string;
  text: string;
  selector: string;
}

export interface ProjectEditHistoryItem {
  id: string;
  createdAt: string;
  userRequest: string;
  assistantSummary: string;
  changedFiles: string[];
  model?: string;
  visualSelections?: PersistedVisualSelection[];
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

export interface ProjectConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  model?: string;
  changedFiles?: string[];
  visualSelections?: PersistedVisualSelection[];
}

export interface ProjectConversation {
  projectId: string;
  createdAt: string;
  updatedAt: string;
  messages: ProjectConversationMessage[];
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
  id: string;
  name: string;
  summary: string;
  model: string;
  template: ProjectTemplate;
  routes: ProjectRoute[];
  session: ProjectSession | null;
  conversation: ProjectConversation | null;
}

export interface CreateProjectResult {
  decision: BuildIntentDecision;
  project?: CreatedProject;
  previewUrl?: string;
}

export interface RuntimeProject {
  projectId: string;
  name: string;
  starred: boolean;
  previewUrl: string;
  template: ProjectTemplate;
  routes: ProjectRoute[];
  session: ProjectSession | null;
  conversation: ProjectConversation | null;
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

export function createProject(prompt: string): Promise<CreateProjectResult> {
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
  const visualEditPrompt = buildVisualEditPrompt(prompt, selections);
  const result = await requestJson<EditedProject>(
    `/api/projects/${encodeURIComponent(projectId)}/edit`,
    {
      method: 'POST',
      body: JSON.stringify({ prompt: visualEditPrompt }),
    },
  );

  if (selections.length) clearCurrentPreviewSelections();
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
