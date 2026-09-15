import { createDefaultAgentRuntime } from '../agent-runtime/agent-runtime.js';
import type {
  ApprovedPlanWorkflowOptions,
  ApprovedPlanWorkflowResult,
} from '../agent-runtime/workflows/approved-plan-workflow.js';

export {
  MAX_APPROVED_PLAN_DEVIATION_LENGTH,
  buildApprovedPlanEditContext,
  mergeApprovedPlanContextSelection,
  parseApprovedPlanPatch,
} from './approved-plan-build-contract.js';
export type { ApprovedPlanPatchResult } from './approved-plan-build-contract.js';

export type BuildFromApprovedPlanOptions = ApprovedPlanWorkflowOptions;
export type ApprovedPlanBuildResult = ApprovedPlanWorkflowResult;

const agentRuntime = createDefaultAgentRuntime();

/** Approved Plan execution always enters through AgentRuntime. */
export function buildProjectFromApprovedPlan(
  projectInput: string,
  options: BuildFromApprovedPlanOptions = {},
): Promise<ApprovedPlanBuildResult> {
  return agentRuntime.executeApprovedPlan(projectInput, options);
}
