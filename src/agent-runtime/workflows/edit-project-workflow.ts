import {
  selectProjectContextFiles,
  type EditContextSelection,
} from '../../editing/context-selection.js';
import { resolveProjectContextSearch } from '../../editing/context-search.js';
import {
  resolveEditIntentDelta,
  type EditIntentResolution,
} from '../../editing/edit-intent.js';
import {
  assertPatchUsesSelectedContext,
  parseProjectPatch,
} from '../../editing/project-change.js';
import {
  buildProjectEditContext,
  extractUserEditContext,
  listProjectContextFiles,
} from '../../editing/project-context.js';
import type { OneShotRepairResult } from '../../editing/repair.js';
import type { FrontendAgentEvent, FrontendAgentProgressOptions } from '../../editing/frontend-agent.js';
import { requestProjectPatch, requestProjectRepair } from '../../model/deepseek.js';
import { readProjectSession } from '../../projects/project-session.js';
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
  agentTrace: FrontendAgentEvent[];
  session: ProjectSessionState | null;
}

export interface EditProjectWorkflowOptions extends FrontendAgentProgressOptions {
  onRunCreated?: (runId: string) => void;
}

export async function runEditProjectWorkflow(
  projectInput: string,
  followUpRequest: string,
  options: EditProjectWorkflowOptions = {},
): Promise<EditProjectWorkflowResult> {
  const request = followUpRequest.trim();
  if (!request) throw new Error('A follow-up edit request is required.');
  if (request.length > MAX_FOLLOW_UP_LENGTH) {
    throw new Error(`Follow-up edit request is too long (max ${MAX_FOLLOW_UP_LENGTH} characters).`);
  }

  const project = await resolveGeneratedProject(projectInput);
  const userEdit = extractUserEditContext(request);
  const session = await readProjectSession(project.directory);
  const agentRun = createAgentRun({
    projectId: project.id,
    kind: 'EDIT',
    prompt: userEdit.userRequest,
  });
  options.onRunCreated?.(agentRun.id);
  const agent = createPersistedAgentRecorder(agentRun.id, options.onEvent);

  const result = await runSourceEditWorkflow({
    project,
    session,
    userRequest: userEdit.userRequest,
    visualSelections: userEdit.visualSelections,
    agent,
    async resolveContext({ userRequest, visualSelections }) {
      const editIntent = await resolveEditIntentDelta({
        userRequest,
        baselineDesignIntent: session?.designIntent ?? null,
        visualSelections,
      });
      const availableFiles = await listProjectContextFiles(project.directory);
      const initialContextSelection = await selectProjectContextFiles(
        { userRequest, visualSelections, editIntent: editIntent.delta },
        availableFiles,
      );
      const contextSelection = await resolveProjectContextSearch(
        project.directory,
        userRequest,
        availableFiles,
        initialContextSelection,
      );
      return { editIntent, availableFiles, contextSelection };
    },
    buildModelContext({ snapshot, editIntent }) {
      return buildProjectEditContext(snapshot, request, session, editIntent.delta);
    },
    requestPatch: requestProjectPatch,
    parsePatch: parseProjectPatch,
    validatePatch: ({ patch, contextSelection }) =>
      assertPatchUsesSelectedContext(project, patch, contextSelection.relevantFiles),
    requestRepair: requestProjectRepair,
  });

  try {
    recordAgentRunTurnDiff(agentRun.id, await result.turnDiff.snapshot());
  } catch (error) {
    console.warn('[Yakable Agent] Agent turn diff could not be persisted.', error);
  }

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
