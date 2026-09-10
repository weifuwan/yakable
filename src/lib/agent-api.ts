export interface AgentHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentPlan {
  summary: string;
  steps: string[];
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
}

export async function runAgentRequest(
  message: string,
  history: AgentHistoryItem[],
): Promise<AgentRunResponse> {
  const response = await fetch('/api/agent/run', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ message, history }),
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<AgentRunResponse> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || `Agent request failed with HTTP ${response.status}`);
  }

  if (typeof payload.message !== 'string') {
    throw new Error('Agent returned an invalid response');
  }

  return payload as AgentRunResponse;
}
