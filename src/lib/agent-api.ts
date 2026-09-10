export interface AgentHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentPlan {
  summary: string;
  steps: string[];
}

export interface ProjectFileSummary {
  path: string;
  size: number;
  updatedAt: string;
}

export interface AgentProjectSnapshot {
  id: string;
  createdAt: string;
  updatedAt: string;
  files: ProjectFileSummary[];
}

export type PreviewRuntimeStatus = 'starting' | 'ready' | 'error' | 'stopped';

export interface PreviewRuntimeSnapshot {
  projectId: string;
  status: PreviewRuntimeStatus;
  revision: number;
  previewUrl?: string;
  startedAt?: string;
  updatedAt?: string;
  error?: string;
}

export interface AgentRepairSummary {
  attempted: boolean;
  attempts: number;
  succeeded: boolean;
  initialError?: string;
  finalError?: string;
  errors: string[];
  changedFiles: string[];
}

export type ProjectVersionOrigin = 'agent' | 'repair' | 'rollback';

export interface ProjectVersionSummary {
  id: string;
  number: number;
  createdAt: string;
  label: string;
  origin: ProjectVersionOrigin;
  sourceVersionId?: string;
  changedFiles: string[];
  additions: number;
  deletions: number;
}

export interface ProjectVersionFileDiff {
  path: string;
  status: 'added' | 'modified' | 'removed';
  additions: number;
  deletions: number;
  beforePreview: string[];
  afterPreview: string[];
}

export interface ProjectVersionDiff {
  version: ProjectVersionSummary;
  against?: ProjectVersionSummary;
  files: ProjectVersionFileDiff[];
  additions: number;
  deletions: number;
}

export interface AgentRunResponse {
  message: string;
  provider: string;
  model: string;
  plan?: AgentPlan;
  events: Array<{
    tool: string;
    status: 'success' | 'error';
  }>;
  project: AgentProjectSnapshot;
  changedFiles: string[];
  runtime: PreviewRuntimeSnapshot;
  repair: AgentRepairSummary;
  version?: ProjectVersionSummary;
  versions: ProjectVersionSummary[];
}

export interface RepairRunResponse {
  project: AgentProjectSnapshot;
  changedFiles: string[];
  runtime: PreviewRuntimeSnapshot;
  repair: AgentRepairSummary;
  version?: ProjectVersionSummary;
  versions: ProjectVersionSummary[];
}

export interface RollbackRunResponse {
  target: ProjectVersionSummary;
  project: AgentProjectSnapshot;
  changedFiles: string[];
  runtime: PreviewRuntimeSnapshot;
  version?: ProjectVersionSummary;
  versions: ProjectVersionSummary[];
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with HTTP ${response.status}`);
  }

  return payload;
}

export async function runAgentRequest(
  projectId: string,
  message: string,
  history: AgentHistoryItem[],
): Promise<AgentRunResponse> {
  const response = await fetch('/api/agent/run', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ projectId, message, history }),
  });

  const payload = await readJson<Partial<AgentRunResponse>>(response);

  if (
    typeof payload.message !== 'string' ||
    !payload.project ||
    !payload.runtime ||
    !payload.repair ||
    !Array.isArray(payload.versions)
  ) {
    throw new Error('Agent returned an invalid response');
  }

  return payload as AgentRunResponse;
}

export async function syncPreviewRuntime(projectId: string) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/runtime`, {
    method: 'POST',
  });

  return readJson<PreviewRuntimeSnapshot>(response);
}

export async function repairPreviewRuntime(
  projectId: string,
  history: AgentHistoryItem[],
) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/repair`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ history }),
  });

  return readJson<RepairRunResponse>(response);
}

export async function listProjectVersions(projectId: string) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/versions`,
  );
  const payload = await readJson<{ versions: ProjectVersionSummary[] }>(response);
  return payload.versions;
}

export async function getProjectVersionDiff(projectId: string, versionId: string) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/diff`,
  );
  return readJson<ProjectVersionDiff>(response);
}

export async function rollbackProjectVersion(projectId: string, versionId: string) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/rollback`,
    { method: 'POST' },
  );
  return readJson<RollbackRunResponse>(response);
}
