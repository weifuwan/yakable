import {
  runApprovedPlanWorkflow,
  type ApprovedPlanWorkflowOptions,
  type ApprovedPlanWorkflowResult,
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

/**
 * Approved Plan execution is owned by AgentRuntime workflows.
 * Planning keeps only its domain contract and this thin entrypoint.
 */
export function buildProjectFromApprovedPlan(
  projectInput: string,
  options: BuildFromApprovedPlanOptions = {},
): Promise<ApprovedPlanBuildResult> {
  return runApprovedPlanWorkflow(projectInput, options);
}
