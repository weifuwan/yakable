import {
  capabilitiesForMode,
  type YakableMode,
  type YakableModeCapability,
} from '../modes/mode-contract.js';

export type AgentRuntimeOperation = 'CREATE' | 'EDIT';

export interface AgentRunContext {
  operation: AgentRuntimeOperation;
  mode: YakableMode;
  prompt: string;
  projectInput?: string;
  startedAt: string;
  capabilities: YakableModeCapability[];
  modelClientId: string;
  availableTools: string[];
}

export interface CreateAgentRunContextInput {
  operation: AgentRuntimeOperation;
  mode?: YakableMode;
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

  const mode = input.mode ?? 'BUILD';
  return {
    operation: input.operation,
    mode,
    prompt,
    ...(projectInput ? { projectInput } : {}),
    startedAt: input.startedAt ?? new Date().toISOString(),
    capabilities: capabilitiesForMode(mode),
    modelClientId: input.modelClientId,
    availableTools: [...new Set(input.availableTools)],
  };
}
