import {
  buildProjectEditContext,
  extractUserEditContext,
  resolveProjectEditContext,
  type EditContextSelection,
} from '../../context/index.js';
import {
  resolveEditIntentDelta,
  type EditIntentResolution,
} from '../../editing/edit-intent.js';
import {
  assertPatchUsesSelectedContext,
  parseProjectPatch,
} from '../../editing/project-change.js';
import type { OneShotRepairResult } from '../../editing/repair.js';
import { requestProjectPatch, requestProjectRepair } from '../../model/deepseek.js';
import { throwIfOperationCancelled } from '../../operation-cancellation.js';
import { readProjectSession } from '../../projects/project-session.js';
import type { AgentProtocolItem } from '../../protocol/agent-protocol.js';
import { resolveGeneratedProject } from '../../runtime/runtime.js';
import { createAgentRun } from '../../storage/agent-run.js';
import { recordAgentRunTurnDiff } from '../../storage/agent-run-turn-diff.js';
import type { CheckProjectOutput } from '../../tools/check-project.js';
import type { ToolResult } from '../../tools/tool.js';
import type {
  ProjectSessionState,
  ProjectVisualSelection,
} from '../../types.js';
import type { WorkspaceChangeSet } from '../../workspace/change-set.js';
import { TurnDiffTracker } from '../../workspace/turn-diff.js';
import { createPersistedAgentRecorder } from '../persisted-recorder.js';
import { runSourceEditWorkflow } from './source-edit-workflow.js';

const MAX_FOLLOW_UP_LENGTH = 8_000;

export interface EditProjectWorkflowResult {
  projectId: string;
  projectDirectory: string;
  userRequest: string;
  visualSelections: ProjectVisualSelection[];
  model: string;
  summary: string;
  changedFiles: string[];
  editIntent: EditIntentResolution;
  contextSelection: EditContextSelection;
  initialChangeSet: WorkspaceChangeSet;
  repair: OneShotRepairResult;
  projectCheck: ToolResult<CheckProjectOutput>;
  agentRunId: string;
  agentTrace: AgentProtocolItem[];
  session: ProjectSessionState | null;
}

export interface EditProjectWorkflowOptions {
  onEvent?: (item: AgentProtocolItem) => void;
  onRunCreated?: (runId: string) => void;
}

async function persistTurnDiff(runId: string, turnDiff: TurnDiffTracker): Promise<void> {
  try {
    recordAgentRunTurnDiff(runId, await turnDiff.snapshot());
  } catch (error) {
    console.warn('[Yakable Agent] Agent turn diff could not be persisted.', error);
  }
}

export async function runEditProjectWorkflow(
  projectInput: string,
  followUpRequest: string,
  options: EditProjectWorkflowOptions = {},
): Promise<EditProjectWorkflowResult> {
  throwIfOperationCancelled();
  const request = followUpRequest.trim();
  if (!request) throw new Error('A follow-up edit request is required.');
  if (request.length > MAX_FOLLOW_UP_LENGTH) {
    throw new Error(`Follow-up edit request is too long (max ${MAX_FOLLOW_UP_LENGTH} characters).`);
  }

  const project = await resolveGeneratedProject(projectInput);
  throwIfOperationCancelled();
  const userEdit = extractUserEditContext(request);
  const session = await readProjectSession(project.directory);
  throwIfOperationCancelled();
  const agentRun = createAgentRun({
    projectId: project.id,
    kind: 'EDIT',
    prompt: userEdit.userRequest,
  });
  options.onRunCreated?.(agentRun.id);
  const agent = createPersistedAgentRecorder(agentRun.id, options.onEvent);
  const turnDiff = new TurnDiffTracker();

  let result: Awaited<ReturnType<typeof runSourceEditWorkflow>>;
  try {
    result = await runSourceEditWorkflow({
      project,
      session,
      userRequest: userEdit.userRequest,
      visualSelections: userEdit.visualSelections,
      agent,
      turnDiff,
      async resolveContext({ userRequest, visualSelections }) {
        throwIfOperationCancelled();
        const editIntent = await resolveEditIntentDelta({
          userRequest,
          baselineDesignIntent: session?.designIntent ?? null,
          visualSelections,
        });
        throwIfOperationCancelled();
        const { availableFiles, contextSelection } = await resolveProjectEditContext({
          projectDirectory: project.directory,
          userRequest,
          visualSelections,
          editIntent: editIntent.delta,
        });
        throwIfOperationCancelled();
        return { editIntent, availableFiles, contextSelection };
      },
      buildModelContext({ snapshot, editIntent }) {
        throwIfOperationCancelled();
        return buildProjectEditContext(snapshot, request, session, editIntent.delta);
      },
      requestPatch: requestProjectPatch,
      parsePatch: parseProjectPatch,
      validatePatch: ({ patch, contextSelection }) => {
        throwIfOperationCancelled();
        return assertPatchUsesSelectedContext(project, patch, contextSelection.relevantFiles);
      },
      requestRepair: requestProjectRepair,
    });
  } catch (error) {
    await persistTurnDiff(agentRun.id, turnDiff);
    throw error;
  }

  throwIfOperationCancelled();
  await persistTurnDiff(agentRun.id, turnDiff);
  throwIfOperationCancelled();

  return {
    projectId: project.id,
    projectDirectory: project.directory,
    userRequest: userEdit.userRequest,
    visualSelections: userEdit.visualSelections,
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
    session,
  };
}
