import { requestJson } from '@/shared/api/client';
import type {
  ProjectListItem,
  ProjectMessageRoutingResult,
  RuntimeProject,
} from '../model/types';

export async function listProjects(): Promise<ProjectListItem[]> {
  const result = await requestJson<{ projects: ProjectListItem[] }>('/api/projects');
  return result.projects;
}

export function startProjectRuntime(
  projectId: string,
  signal?: AbortSignal,
): Promise<RuntimeProject> {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}/runtime`, {
    method: 'POST',
    body: '{}',
    signal,
  });
}

export function routeProjectMessage(
  projectId: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<ProjectMessageRoutingResult> {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}/message`, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
    signal,
  });
}

export async function updateProject(
  projectId: string,
  patch: { name?: string; starred?: boolean },
): Promise<ProjectListItem> {
  const result = await requestJson<{ project: ProjectListItem }>(
    `/api/projects/${encodeURIComponent(projectId)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
  return result.project;
}

export async function remixProject(projectId: string): Promise<ProjectListItem> {
  const result = await requestJson<{ project: ProjectListItem }>(
    `/api/projects/${encodeURIComponent(projectId)}/remix`,
    { method: 'POST', body: '{}' },
  );
  return result.project;
}

export async function deleteProject(projectId: string): Promise<void> {
  await requestJson<{ ok: true; projectId: string }>(
    `/api/projects/${encodeURIComponent(projectId)}`,
    { method: 'DELETE' },
  );
}
