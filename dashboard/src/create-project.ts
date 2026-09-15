import type { AgentProtocolItem } from '../../src/protocol/agent-protocol';

export type BuildIntentRoute = 'CREATE' | 'CHAT' | 'CLARIFY';
export type BuildIntentConfidence = 'high' | 'medium';

export interface BuildIntentDecision {
  version: 1;
  route: BuildIntentRoute;
  confidence: BuildIntentConfidence;
  message: string;
}

export type ProjectLifecycleStatus =
  | 'CREATING'
  | 'GENERATING'
  | 'STARTING_RUNTIME'
  | 'READY'
  | 'FAILED';

export type AgentRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface ProjectCreationProject {
  id: string;
  name: string;
  prompt: string;
  status: ProjectLifecycleStatus;
  activeRunId?: string;
  failureMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCreationRun {
  id: string;
  status: AgentRunStatus;
  model?: string;
  summary?: string;
  startedAt: string;
  completedAt?: string;
  items?: AgentProtocolItem[];
}

export interface ProjectCreationStatus {
  project: ProjectCreationProject;
  run: ProjectCreationRun | null;
}

export type ProjectBootstrapResult =
  | {
      accepted: true;
      decision: BuildIntentDecision;
      project: ProjectCreationProject;
      run: ProjectCreationRun;
    }
  | {
      accepted: false;
      decision: BuildIntentDecision;
    };

function errorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === 'object'
    && payload !== null
    && 'error' in payload
    && typeof (payload as { error?: unknown }).error === 'string'
  ) {
    return (payload as { error: string }).error;
  }
  return fallback;
}

export async function bootstrapProject(prompt: string): Promise<ProjectBootstrapResult> {
  const response = await fetch('/api/projects/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(errorMessage(payload, `Yakable API failed with HTTP ${response.status}.`));
  }
  return payload as ProjectBootstrapResult;
}

export async function readProjectCreationStatus(
  projectId: string,
): Promise<ProjectCreationStatus | null> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/creation`,
    { headers: { Accept: 'application/json' } },
  );
  if (response.status === 404) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(errorMessage(payload, `Yakable API failed with HTTP ${response.status}.`));
  }
  return payload as ProjectCreationStatus;
}
