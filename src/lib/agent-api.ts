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
}

export interface RepairRunResponse {
  project: AgentProjectSnapshot;
  changedFiles: string[];
  runtime: PreviewRuntimeSnapshot;
  repair: AgentRepairSummary;
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
    !payload.repair
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
