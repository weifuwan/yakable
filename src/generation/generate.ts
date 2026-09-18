import { createDefaultAgentRuntime } from '../agent-runtime/agent-runtime.js';
import type { CreateProjectWorkflowOptions } from '../agent-runtime/workflows/create-project-workflow.js';
import type { GenerationResult } from '../types.js';

export {
  ProjectGenerationError,
  buildProjectGenerationRecoveryRequest,
} from '../agent-runtime/workflows/create-project-workflow.js';

export type GenerateProjectOptions = CreateProjectWorkflowOptions;

const agentRuntime = createDefaultAgentRuntime();

/** Project creation always enters through AgentRuntime. */
export function generateProject(
  prompt: string,
  options: GenerateProjectOptions = {},
): Promise<GenerationResult> {
  return agentRuntime.createProject(prompt, options);
}
