import {
  selectProjectContextFiles,
  type EditContextSelection,
} from './context-selection.js';
import { resolveProjectContextSearch } from './context-search.js';
import {
  resolveEditIntentDelta,
  type EditIntentResolution,
} from './edit-intent.js';
import {
  createFrontendAgentRecorder,
  runFrontendAgentStage,
  type FrontendAgentEvent,
  type FrontendAgentProgressOptions,
} from './frontend-agent.js';
import {
  applyProjectChanges,
  assertPatchUsesSelectedContext,
  createProjectChangeManager,
  parseProjectPatch,
} from './project-change.js';
import {
  buildProjectEditContext,
  extractUserEditContext,
  listProjectContextFiles,
  readProjectSnapshot,
} from './project-context.js';
import { runOneShotRepair, type OneShotRepairResult } from './repair.js';
import { requestProjectPatch, requestProjectRepair } from '../model/deepseek.js';
import { readProjectSession } from '../projects/project-session.js';
import { resolveGeneratedProject } from '../runtime/runtime.js';
import { createAgentRun } from '../storage/agent-run.js';
import { upsertAgentRunItem } from '../storage/agent-run-item.js';
import { recordAgentRunTurnDiff } from '../storage/agent-run-turn-diff.js';
import { checkProjectTool, type CheckProjectOutput } from '../tools/check-project.js';
import type { ToolResult } from '../tools/tool.js';
import type { ProjectSessionState, ProjectVisualSelection } from '../types.js';
import {
  workspaceChangedPaths,
  type WorkspaceChangeSet,
} from '../workspace/change-set.js';
import { TurnDiffTracker } from '../workspace/turn-diff.js';

const MAX_FOLLOW_UP_LENGTH = 8_000;

export interface EditProjectResult {
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

export interface EditGeneratedProjectOptions extends FrontendAgentProgressOptions {
  onRunCreated?: (runId: string) => void;
}

async function persistTurnDiff(runId: string, tracker: TurnDiffTracker): Promise<void> {
  try {
    recordAgentRunTurnDiff(runId, await tracker.snapshot());
  } catch (error) {
    console.warn('[Yakable Agent] Agent turn diff could not be persisted.', error);
  }
}

export async function editGeneratedProject(
  projectInput: string,
  followUpRequest: string,
  options: EditGeneratedProjectOptions = {},
): Promise<EditProjectResult> {
  const request = followUpRequest.trim();
  if (!request) throw new Error('A follow-up edit request is required.');
  if (request.length > MAX_FOLLOW_UP_LENGTH) {
    throw new Error(`Follow-up edit request is too long (max ${MAX_FOLLOW_UP_LENGTH} characters).`);
  }

  const project = await resolveGeneratedProject(projectInput);
  const changeManager = createProjectChangeManager(project);
  const turnDiff = new TurnDiffTracker();
  const userEdit = extractUserEditContext(request);
  const session = await readProjectSession(project.directory);
  const agentRun = createAgentRun({
    projectId: project.id,
    kind: 'EDIT',
    prompt: userEdit.userRequest,
  });
  options.onRunCreated?.(agentRun.id);

  const agent = createFrontendAgentRecorder({
    onEvent(item) {
      try {
        upsertAgentRunItem(agentRun.id, item);
      } catch (error) {
        console.warn('[Yakable Agent] Agent item could not be persisted.', error);
      }
      options.onEvent?.(item);
    },
  });

  const prepared = await runFrontendAgentStage(
    agent,
    'SELECT_CONTEXT',
    'Understanding the edit and selecting focused frontend context',
    'Selected focused frontend context',
    async () => {
      const editIntent = await resolveEditIntentDelta({
        userRequest: userEdit.userRequest,
        baselineDesignIntent: session?.designIntent ?? null,
        visualSelections: userEdit.visualSelections,
      });
      const availableFiles = await listProjectContextFiles(project.directory);
      const initialContextSelection = await selectProjectContextFiles(
        { ...userEdit, editIntent: editIntent.delta },
        availableFiles,
      );
      const contextSelection = await resolveProjectContextSearch(
        project.directory,
        userEdit.userRequest,
        availableFiles,
        initialContextSelection,
      );
      return { editIntent, availableFiles, contextSelection };
    },
  );

  const { editIntent, availableFiles, contextSelection } = prepared;
  const snapshot = await runFrontendAgentStage(
    agent,
    'READ',
    'Reading only the selected project files',
    `Read ${contextSelection.relevantFiles.length} selected project file(s)`,
    () => readProjectSnapshot(project, contextSelection.relevantFiles),
  );
  const editContext = buildProjectEditContext(snapshot, request, session, editIntent.delta);

  const edited = await runFrontendAgentStage(
    agent,
    'EDIT',
    'Applying the requested frontend change',
    'Applied the bounded frontend source edit',
    async () => {
      const generation = await requestProjectPatch(editContext);
      const patch = parseProjectPatch(generation.content);
      await assertPatchUsesSelectedContext(project, patch, contextSelection.relevantFiles);
      const initialChangeSet = await applyProjectChanges(changeManager, patch, agent);
      turnDiff.record(initialChangeSet);
      return { generation, patch, initialChangeSet };
    },
  );

  const { generation, patch, initialChangeSet } = edited;
  const initialChangedFiles = workspaceChangedPaths(initialChangeSet);
  agent.emit('CHECK', 'ACTIVE', 'Checking TypeScript and build health');

  let repair: OneShotRepairResult;
  try {
    const initialProjectCheck = await checkProjectTool.execute(
      {},
      { projectDirectory: project.directory, agent },
    );

    repair = await runOneShotRepair({
      projectId: project.id,
      userRequest: userEdit.userRequest,
      initialEditSummary: patch.summary,
      initialChangedFiles,
      selectedContextFiles: contextSelection.relevantFiles,
      availableFiles,
      initialCheck: initialProjectCheck,
      readFiles: async (paths) => (await readProjectSnapshot(project, paths)).files,
      requestRepair: requestProjectRepair,
      parsePatch: parseProjectPatch,
      applyChanges: async (repairPatch) => {
        const changeSet = await applyProjectChanges(changeManager, repairPatch, agent);
        turnDiff.record(changeSet);
        return changeSet;
      },
      checkProject: () =>
        checkProjectTool.execute({}, { projectDirectory: project.directory, agent }),
    });
  } catch (error) {
    agent.emit(
      'CHECK',
      'FAILED',
      `Project health check failed to complete: ${error instanceof Error ? error.message : String(error)}`,
    );
    await persistTurnDiff(agentRun.id, turnDiff);
    throw error;
  }

  const changedFiles = [...new Set([...initialChangedFiles, ...repair.changedFiles])];
  const projectCheck = repair.finalCheck;
  if (projectCheck.ok && projectCheck.value.status === 'PASS') {
    agent.emit(
      'CHECK',
      'COMPLETED',
      repair.attempted
        ? 'Project is code-healthy after one bounded build repair'
        : 'Project is code-healthy',
    );
  } else {
    agent.emit(
      'CHECK',
      'FAILED',
      projectCheck.ok
        ? 'Project health check still reports source errors'
        : `Project health check could not run: ${projectCheck.error.message}`,
    );
  }

  await persistTurnDiff(agentRun.id, turnDiff);

  return {
    projectId: project.id,
    projectDirectory: project.directory,
    userRequest: userEdit.userRequest,
    visualSelections: userEdit.visualSelections,
    model: generation.model,
    summary: patch.summary,
    changedFiles,
    editIntent,
    contextSelection,
    initialChangeSet,
    repair,
    projectCheck,
    agentRunId: agentRun.id,
    agentTrace: agent.snapshot(),
    session,
  };
}
