import type { EditContextSelection } from '../../editing/context-selection.js';
import type { EditIntentResolution } from '../../editing/edit-intent.js';
import {
  applyProjectChanges,
  createProjectChangeManager,
  parseProjectPatch,
} from '../../editing/project-change.js';
import type { ProjectSnapshot } from '../../editing/project-context.js';
import {
  runOneShotRepair,
  type OneShotRepairResult,
  type RepairGeneration,
} from '../../editing/repair.js';
import {
  runAgentStage,
  type AgentProtocolRecorder,
} from '../../protocol/agent-recorder.js';
import type { ResolvedGeneratedProject } from '../../runtime/runtime.js';
import type { CheckProjectOutput } from '../../tools/check-project.js';
import type { ToolResult } from '../../tools/tool.js';
import type {
  ProjectPatch,
  ProjectSessionState,
  ProjectVisualSelection,
} from '../../types.js';
import {
  workspaceChangedPaths,
  type WorkspaceChangeSet,
} from '../../workspace/change-set.js';
import { TurnDiffTracker } from '../../workspace/turn-diff.js';
import {
  checkWorkflowProject,
  readWorkflowProjectSnapshot,
  type AgentWorkflowContext,
} from '../workflow-context.js';

export interface SourceEditGeneration {
  content: string;
  model: string;
}

export interface SourceEditContextResult {
  editIntent: EditIntentResolution;
  availableFiles: string[];
  contextSelection: EditContextSelection;
}

export interface SourceEditWorkflowMessages {
  selectingActive: string;
  selectingCompleted: string;
  readingActive: string;
  editingActive: string;
  editingCompleted: string;
  checkingActive: string;
  healthy: string;
  healthyAfterRepair: string;
  unhealthy: string;
  repairActive: string;
  repairCompleted: string;
  repairFailed: string;
}

export interface SourceEditWorkflowInput {
  context: AgentWorkflowContext;
  project: ResolvedGeneratedProject;
  session: ProjectSessionState | null;
  userRequest: string;
  visualSelections: ProjectVisualSelection[];
  agent: AgentProtocolRecorder;
  resolveContext(input: {
    project: ResolvedGeneratedProject;
    session: ProjectSessionState | null;
    userRequest: string;
    visualSelections: ProjectVisualSelection[];
  }): Promise<SourceEditContextResult>;
  buildModelContext(input: {
    snapshot: ProjectSnapshot;
    session: ProjectSessionState | null;
    userRequest: string;
    editIntent: EditIntentResolution;
    contextSelection: EditContextSelection;
  }): string;
  requestPatch(context: string): Promise<SourceEditGeneration>;
  parsePatch(rawContent: string): ProjectPatch;
  validatePatch?(input: {
    project: ResolvedGeneratedProject;
    patch: ProjectPatch;
    contextSelection: EditContextSelection;
  }): Promise<void> | void;
  requestRepair(context: string): Promise<RepairGeneration>;
  repairParsePatch?: (rawContent: string) => ProjectPatch;
  turnDiff?: TurnDiffTracker;
  messages?: Partial<SourceEditWorkflowMessages>;
}

export interface SourceEditWorkflowResult {
  project: ResolvedGeneratedProject;
  session: ProjectSessionState | null;
  generation: SourceEditGeneration;
  patch: ProjectPatch;
  editIntent: EditIntentResolution;
  contextSelection: EditContextSelection;
  availableFiles: string[];
  initialChangeSet: WorkspaceChangeSet;
  repair: OneShotRepairResult;
  changedFiles: string[];
  projectCheck: ToolResult<CheckProjectOutput>;
  turnDiff: TurnDiffTracker;
}

const DEFAULT_MESSAGES: SourceEditWorkflowMessages = {
  selectingActive: 'Understanding the edit and selecting focused frontend context',
  selectingCompleted: 'Selected focused frontend context',
  readingActive: 'Reading only the selected project files',
  editingActive: 'Applying the requested frontend change',
  editingCompleted: 'Applied the bounded frontend source edit',
  checkingActive: 'Checking TypeScript and build health',
  healthy: 'Project is code-healthy',
  healthyAfterRepair: 'Project is code-healthy after one bounded build repair',
  unhealthy: 'Project health check still reports source errors',
  repairActive: 'Applying one bounded build repair',
  repairCompleted: 'Applied one code-healthy build repair',
  repairFailed: 'The bounded build repair did not produce a healthy project',
};

function messagesFor(
  overrides: Partial<SourceEditWorkflowMessages> | undefined,
): SourceEditWorkflowMessages {
  return { ...DEFAULT_MESSAGES, ...(overrides ?? {}) };
}

export async function runSourceEditWorkflow(
  input: SourceEditWorkflowInput,
): Promise<SourceEditWorkflowResult> {
  const messages = messagesFor(input.messages);
  const turnDiff = input.turnDiff ?? new TurnDiffTracker();
  const changeManager = createProjectChangeManager(input.project);

  const prepared = await runAgentStage(
    input.agent,
    'SELECT_CONTEXT',
    messages.selectingActive,
    messages.selectingCompleted,
    () =>
      input.resolveContext({
        project: input.project,
        session: input.session,
        userRequest: input.userRequest,
        visualSelections: input.visualSelections,
      }),
  );

  const { editIntent, availableFiles, contextSelection } = prepared;
  const snapshot = await runAgentStage(
    input.agent,
    'READ',
    messages.readingActive,
    `Read ${contextSelection.relevantFiles.length} selected project file(s)`,
    () => readWorkflowProjectSnapshot(
      input.context,
      input.project,
      contextSelection.relevantFiles,
      input.agent,
    ),
  );

  const modelContext = input.buildModelContext({
    snapshot,
    session: input.session,
    userRequest: input.userRequest,
    editIntent,
    contextSelection,
  });

  const edited = await runAgentStage(
    input.agent,
    'EDIT',
    messages.editingActive,
    messages.editingCompleted,
    async () => {
      const generation = await input.requestPatch(modelContext);
      const patch = input.parsePatch(generation.content);
      await input.validatePatch?.({
        project: input.project,
        patch,
        contextSelection,
      });
      const initialChangeSet = await applyProjectChanges(changeManager, patch, input.agent);
      turnDiff.record(initialChangeSet);
      return { generation, patch, initialChangeSet };
    },
  );

  const { generation, patch, initialChangeSet } = edited;
  const initialChangedFiles = workspaceChangedPaths(initialChangeSet);
  input.agent.emit('CHECK', 'ACTIVE', messages.checkingActive);

  let repair: OneShotRepairResult;
  try {
    const initialProjectCheck = await checkWorkflowProject(
      input.context,
      input.project.directory,
      input.agent,
    );

    if (initialProjectCheck.ok && initialProjectCheck.value.status === 'FAIL') {
      input.agent.emit('REPAIR', 'ACTIVE', messages.repairActive);
    }

    repair = await runOneShotRepair({
      projectId: input.project.id,
      userRequest: input.userRequest,
      initialEditSummary: patch.summary,
      initialChangedFiles,
      selectedContextFiles: contextSelection.relevantFiles,
      availableFiles,
      initialCheck: initialProjectCheck,
      readFiles: async (paths) => (
        await readWorkflowProjectSnapshot(input.context, input.project, paths, input.agent)
      ).files,
      requestRepair: input.requestRepair,
      parsePatch: input.repairParsePatch ?? parseProjectPatch,
      applyChanges: async (repairPatch) => {
        const changeSet = await applyProjectChanges(changeManager, repairPatch, input.agent);
        turnDiff.record(changeSet);
        return changeSet;
      },
      checkProject: () => checkWorkflowProject(
        input.context,
        input.project.directory,
        input.agent,
      ),
    });
  } catch (error) {
    input.agent.emit(
      'CHECK',
      'FAILED',
      `Project health check failed to complete: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }

  if (repair.attempted) {
    input.agent.emit(
      'REPAIR',
      repair.status === 'REPAIRED' ? 'COMPLETED' : 'FAILED',
      repair.status === 'REPAIRED'
        ? messages.repairCompleted
        : repair.error || messages.repairFailed,
    );
  }

  const projectCheck = repair.finalCheck;
  if (projectCheck.ok && projectCheck.value.status === 'PASS') {
    input.agent.emit(
      'CHECK',
      'COMPLETED',
      repair.attempted ? messages.healthyAfterRepair : messages.healthy,
    );
  } else {
    input.agent.emit(
      'CHECK',
      'FAILED',
      projectCheck.ok
        ? messages.unhealthy
        : `Project health check could not run: ${projectCheck.error.message}`,
    );
  }

  return {
    project: input.project,
    session: input.session,
    generation,
    patch,
    editIntent,
    contextSelection,
    availableFiles,
    initialChangeSet,
    repair,
    changedFiles: [...new Set([...initialChangedFiles, ...repair.changedFiles])],
    projectCheck,
    turnDiff,
  };
}
