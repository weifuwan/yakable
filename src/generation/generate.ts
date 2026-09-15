import {
  runCreateProjectWorkflow,
  type CreateProjectWorkflowOptions,
} from '../agent-runtime/workflows/create-project-workflow.js';
import type { GenerationResult } from '../types.js';

export {
  ProjectGenerationError,
  buildProjectGenerationRecoveryRequest,
} from '../agent-runtime/workflows/create-project-workflow.js';

export type GenerateProjectOptions = CreateProjectWorkflowOptions;

/**
 * Project creation is owned by AgentRuntime workflows.
 * Generation keeps this domain-facing entrypoint only.
 */
export function generateProject(
  prompt: string,
  options: GenerateProjectOptions = {},
): Promise<GenerationResult> {
  return runCreateProjectWorkflow(prompt, options);
}
