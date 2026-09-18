export type AgentRuntimeOperation = 'CREATE' | 'EDIT';

export interface AgentRunContext {
  operation: AgentRuntimeOperation;
  prompt: string;
  projectInput?: string;
  startedAt: string;
  modelClientId: string;
  availableTools: string[];
}

export interface CreateAgentRunContextInput {
  operation: AgentRuntimeOperation;
  prompt: string;
  projectInput?: string;
  modelClientId: string;
  availableTools: string[];
  startedAt?: string;
}

export function createAgentRunContext(
  input: CreateAgentRunContextInput,
): AgentRunContext {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error('Agent run prompt is required.');

  const projectInput = input.projectInput?.trim();
  if (input.operation === 'EDIT' && !projectInput) {
    throw new Error('Edit agent runs require a project input.');
  }

  return {
    operation: input.operation,
    prompt,
    ...(projectInput ? { projectInput } : {}),
    startedAt: input.startedAt ?? new Date().toISOString(),
    modelClientId: input.modelClientId,
    availableTools: [...new Set(input.availableTools)],
  };
}
