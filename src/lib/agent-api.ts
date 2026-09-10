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

  const payload = (await response.json().catch(() => ({}))) as Partial<AgentRunResponse> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || `Agent request failed with HTTP ${response.status}`);
  }

  if (typeof payload.message !== 'string' || !payload.project) {
    throw new Error('Agent returned an invalid response');
  }

  return payload as AgentRunResponse;
}
