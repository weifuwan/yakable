import { createDefaultAgentWorkflowContext } from '../agent-runtime/workflow-context.js';
import {
  runEditProjectWorkflow,
  type EditProjectWorkflowOptions,
  type EditProjectWorkflowResult,
} from '../agent-runtime/workflows/edit-project-workflow.js';

export type EditProjectResult = EditProjectWorkflowResult;
export type EditGeneratedProjectOptions = EditProjectWorkflowOptions;

export {
  listProjectContextFiles,
  readProjectSnapshot,
} from './project-context.js';

/** Standalone edit facade. AgentRuntime passes its own WorkflowContext directly. */
export function editGeneratedProject(
  projectInput: string,
  followUpRequest: string,
  options: EditGeneratedProjectOptions = {},
): Promise<EditProjectResult> {
  return runEditProjectWorkflow(
    createDefaultAgentWorkflowContext('BUILD'),
    projectInput,
    followUpRequest,
    options,
  );
}
