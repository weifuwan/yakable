import {
  selectProjectContextFiles,
  type EditContextSelection,
} from '../../editing/context-selection.js';
import { resolveProjectContextSearch } from '../../editing/context-search.js';
import {
  resolveEditIntentDelta,
  type EditIntentResolution,
} from '../../editing/edit-intent.js';
import { assertPatchUsesSelectedContext } from '../../editing/project-change.js';
import { listProjectContextFiles } from '../../editing/project-context.js';
import type { OneShotRepairResult } from '../../editing/repair.js';
import type { FrontendAgentEvent, FrontendAgentProgressOptions } from '../../editing/frontend-agent.js';
import { assertModeCapability, type YakableMode } from '../../modes/mode-contract.js';
import { requestProjectPatch, requestProjectRepair } from '../../model/deepseek.js';
import {
  ApprovedPlanExecutionError,
  buildApprovedPlanExecutionRequest,
  compileApprovedPlanExecutionContract,
  type ApprovedPlanExecutionContract,
} from '../../planning/approved-plan-contract.js';
import {
  attachApprovedPlanToRepairRequest,
  buildApprovedPlanEditContext,
  mergeApprovedPlanContextSelection,
  parseApprovedPlanPatch,
} from '../../planning/approved-plan-build-contract.js';
import { readPlanArtifactFromDirectory } from '../../planning/plan-artifact.js';
import {
  appendProjectEditHistory,
  readProjectSession,
} from '../../projects/project-session.js';
import { resolveGeneratedProject } from '../../runtime/runtime.js';
import { completeAgentRun, createAgentRun } from '../../storage/agent-run.js';
import { recordAgentRunTurnDiff } from '../../storage/agent-run-turn-diff.js';
import type { CheckProjectOutput } from '../../tools/check-project.js';
import type { ToolResult } from '../../tools/tool.js';
import type { ProjectSessionState } from '../../types.js';
import type { WorkspaceChangeSet } from '../../workspace/change-set.js';
import { createPersistedAgentRecorder } from '../persisted-recorder.js';
import { runSourceEditWorkflow } from './source-edit-workflow.js';

export interface ApprovedPlanWorkflowOptions extends FrontendAgentProgressOptions {
  mode?: YakableMode;
  generatedRoot?: string;
}

export interface ApprovedPlanWorkflowResult {
  projectId: string;
  projectDirectory: string;
  model: string;
  summary: string;
  changedFiles: string[];
  editIntent: EditIntentResolution;
  contextSelection: EditContextSelection;
  initialChangeSet: WorkspaceChangeSet;
  repair: OneShotRepairResult;
  projectCheck: ToolResult<CheckProjectOutput>;
  agentRunId: string;
  agentTrace: FrontendAgentEvent[];
  session: ProjectSessionState | null;
  executionPlan: ApprovedPlanExecutionContract;
}

export async function runApprovedPlanWorkflow(
  projectInput: string,
  options: ApprovedPlanWorkflowOptions = {},
): Promise<ApprovedPlanWorkflowResult> {
  const mode = options.mode ?? 'BUILD';
  assertModeCapability(mode, 'execute-plan');
  assertModeCapability(mode, 'read-plan');
  assertModeCapability(mode, 'edit-source');

  const project = await resolveGeneratedProject(projectInput, options.generatedRoot);
  const persistedPlan = await readPlanArtifactFromDirectory(project.directory, mode);
  if (!persistedPlan) {
    throw new ApprovedPlanExecutionError(
      'APPROVED_PLAN_NOT_FOUND',
      'No Plan Artifact exists for this project. Draft and approve a plan before Build.',
    );
  }

  const executionPlan = compileApprovedPlanExecutionContract(persistedPlan);
  const executionRequest = buildApprovedPlanExecutionRequest(executionPlan);
  const historyRequest = `[Approved Plan r${executionPlan.source.revision}] ${executionPlan.goal}`;
  const session = await readProjectSession(project.directory);
  const agentRun = createAgentRun({
    projectId: project.id,
    kind: 'EDIT',
    prompt: historyRequest,
  });
  const agent = createPersistedAgentRecorder(agentRun.id, options.onEvent);

  try {
    const result = await runSourceEditWorkflow({
      project,
      session,
      userRequest: executionRequest,
      visualSelections: [],
      agent,
      async resolveContext() {
        const editIntent = await resolveEditIntentDelta({
          userRequest: executionRequest,
          baselineDesignIntent: session?.designIntent ?? null,
          visualSelections: [],
        });
        const availableFiles = await listProjectContextFiles(project.directory);
        const initialSelection = await selectProjectContextFiles(
          { userRequest: executionRequest, visualSelections: [], editIntent: editIntent.delta },
          availableFiles,
        );
        const searchedSelection = await resolveProjectContextSearch(
          project.directory,
          executionRequest,
          availableFiles,
          initialSelection,
        );
        const contextSelection = mergeApprovedPlanContextSelection(
          searchedSelection,
          executionPlan,
          availableFiles,
        );
        return { editIntent, availableFiles, contextSelection };
      },
      buildModelContext({ snapshot, editIntent }) {
        return buildApprovedPlanEditContext(
          snapshot,
          executionRequest,
          session,
          editIntent.delta,
          executionPlan,
        );
      },
      requestPatch: requestProjectPatch,
      parsePatch(rawContent) {
        const parsed = parseApprovedPlanPatch(rawContent);
        if (parsed.status === 'BLOCKED') {
          throw new ApprovedPlanExecutionError(
            'APPROVED_PLAN_BUILD_BLOCKED',
            `Approved Plan Build stopped before source mutation: ${parsed.deviations.join(' | ')}`,
            parsed.deviations,
          );
        }
        return parsed.patch;
      },
      validatePatch: ({ patch, contextSelection }) =>
        assertPatchUsesSelectedContext(project, patch, contextSelection.relevantFiles),
      requestRepair: (repairContext) =>
        requestProjectRepair(attachApprovedPlanToRepairRequest(repairContext, executionPlan)),
      messages: {
        selectingActive: `Loading approved Plan revision ${executionPlan.source.revision} and selecting execution context`,
        selectingCompleted: `Selected execution context for approved Plan revision ${executionPlan.source.revision}`,
        readingActive: 'Reading only the approved-plan execution context',
        editingActive: `Executing approved Plan revision ${executionPlan.source.revision}`,
        editingCompleted: `Applied approved Plan revision ${executionPlan.source.revision}`,
        healthy: 'Approved Plan is code-healthy',
        healthyAfterRepair: 'Approved Plan is code-healthy after one bounded build repair',
        unhealthy: 'Approved Plan execution still has source errors',
      },
    });

    let nextSession = session;
    try {
      nextSession = await appendProjectEditHistory(project.directory, {
        userRequest: historyRequest,
        assistantSummary: result.patch.summary,
        changedFiles: result.changedFiles,
        model: result.generation.model,
      });
    } catch (error) {
      console.warn(
        '[Yakable Approved Plan Build] Source update succeeded but conversation history could not be persisted.',
        error,
      );
    }

    agent.message(result.patch.summary);
    agent.progress('DONE', 'COMPLETED', 'Approved Plan execution completed');
    recordAgentRunTurnDiff(agentRun.id, await result.turnDiff.snapshot());
    completeAgentRun(agentRun.id, {
      model: result.generation.model,
      summary: result.patch.summary,
    });

    return {
      projectId: project.id,
      projectDirectory: project.directory,
      model: result.generation.model,
      summary: result.patch.summary,
      changedFiles: result.changedFiles,
      editIntent: result.editIntent,
      contextSelection: result.contextSelection,
      initialChangeSet: result.initialChangeSet,
      repair: result.repair,
      projectCheck: result.projectCheck,
      agentRunId: agentRun.id,
      agentTrace: agent.snapshot(),
      session: nextSession,
      executionPlan,
    };
  } catch (error) {
    completeAgentRun(agentRun.id);
    throw error;
  }
}
