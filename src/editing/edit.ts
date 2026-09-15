import {
  runEditProjectWorkflow,
  type EditProjectWorkflowOptions,
  type EditProjectWorkflowResult,
} from '../agent-runtime/workflows/edit-project-workflow.js';

export type EditProjectResult = EditProjectWorkflowResult;
export type EditGeneratedProjectOptions = EditProjectWorkflowOptions;

/**
 * Editing is now an AgentRuntime workflow concern.
 *
 * This module remains the domain-facing edit entrypoint only; it owns no
 * orchestration, persistence, tool execution, repair loop, or diff lifecycle.
 */
export function editGeneratedProject(
  projectInput: string,
  followUpRequest: string,
  options: EditGeneratedProjectOptions = {},
): Promise<EditProjectResult> {
  return runEditProjectWorkflow(projectInput, followUpRequest, options);
}
