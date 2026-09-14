import {
  MAX_EDIT_CONTEXT_FILES,
  selectProjectContextFiles,
  type EditContextSelection,
} from '../editing/context-selection.js';
import { resolveProjectContextSearch } from '../editing/context-search.js';
import {
  applyProjectPatch,
  assertPatchUsesSelectedContext,
  listProjectContextFiles,
  parseProjectPatch,
  readProjectSnapshot,
  type EditProjectResult,
  type ProjectSnapshot,
} from '../editing/edit.js';
import {
  resolveEditIntentDelta,
  type EditIntentDelta,
} from '../editing/edit-intent.js';
import {
  createFrontendAgentRecorder,
  runFrontendAgentStage,
  type FrontendAgentProgressOptions,
} from '../editing/frontend-agent.js';
import { runOneShotRepair, type OneShotRepairResult } from '../editing/repair.js';
import { requestProjectPatch, requestProjectRepair } from '../model/deepseek.js';
import {
  appendProjectEditHistory,
  readProjectSession,
} from '../projects/project-session.js';
import { resolveGeneratedProject } from '../runtime/runtime.js';
import { checkProjectTool } from '../tools/check-project.js';
import type { ProjectPatch, ProjectSessionState } from '../types.js';
import {
  ApprovedPlanExecutionError,
  buildApprovedPlanExecutionRequest,
  collectApprovedPlanContextHints,
  compileApprovedPlanExecutionContract,
  type ApprovedPlanExecutionContract,
} from './approved-plan-contract.js';
import { readPlanArtifactFromDirectory } from './plan-artifact.js';

const MAX_APPROVED_PLAN_DEVIATION_LENGTH = 600;
const MAX_HISTORY_CONTEXT = 12;

export interface BuildFromApprovedPlanOptions extends FrontendAgentProgressOptions {
  generatedRoot?: string;
}

export interface ApprovedPlanBuildResult extends EditProjectResult {
  executionPlan: ApprovedPlanExecutionContract;
}

export type ApprovedPlanPatchResult =
  | {
      status: 'APPLIED';
      summary: string;
      deviations: [];
      patch: ProjectPatch;
    }
  | {
      status: 'BLOCKED';
      summary: string;
      deviations: string[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readDeviations(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error('Approved Plan Build output deviations must be an array.');
  }
  const deviations: string[] = [];
  for (const [index, item] of value.entries()) {
    if (typeof item !== 'string') {
      throw new Error(`Approved Plan Build deviations[${index}] must be a string.`);
    }
    const text = item.trim();
    if (!text || text.length > MAX_APPROVED_PLAN_DEVIATION_LENGTH) {
      throw new Error(
        `Approved Plan Build deviations[${index}] must contain 1-${MAX_APPROVED_PLAN_DEVIATION_LENGTH} characters.`,
      );
    }
    if (!deviations.includes(text)) deviations.push(text);
    if (deviations.length > 8) {
      throw new Error('Approved Plan Build may report at most 8 deviations.');
    }
  }
  return deviations;
}

export function parseApprovedPlanPatch(rawContent: string): ApprovedPlanPatchResult {
  let value: unknown;
  try {
    value = JSON.parse(rawContent);
  } catch {
    throw new Error('Approved Plan Build model output was not valid JSON.');
  }
  if (!isRecord(value) || typeof value.summary !== 'string') {
    throw new Error('Approved Plan Build output must contain status, summary, deviations, and changes.');
  }
  const summary = value.summary.trim();
  if (!summary) throw new Error('Approved Plan Build summary is required.');
  if (value.status !== 'APPLIED' && value.status !== 'BLOCKED') {
    throw new Error('Approved Plan Build status must be APPLIED or BLOCKED.');
  }
  const deviations = readDeviations(value.deviations ?? []);

  if (value.status === 'BLOCKED') {
    if (deviations.length === 0) {
      throw new Error('Blocked Approved Plan Build must report at least one concrete deviation.');
    }
    if (Array.isArray(value.changes) && value.changes.length > 0) {
      throw new Error('Blocked Approved Plan Build must not return source changes.');
    }
    return { status: 'BLOCKED', summary, deviations };
  }

  if (deviations.length > 0) {
    throw new Error('Applied Approved Plan Build cannot contain deviations.');
  }
  const patch = parseProjectPatch(
    JSON.stringify({ summary, changes: value.changes }),
  );
  return { status: 'APPLIED', summary, deviations: [], patch };
}

export function mergeApprovedPlanContextSelection(
  selection: EditContextSelection,
  contract: ApprovedPlanExecutionContract,
  availableFiles: string[],
): EditContextSelection {
  const planHints = collectApprovedPlanContextHints(contract, availableFiles);
  const relevantFiles: string[] = [];
  for (const file of [...planHints, ...selection.relevantFiles]) {
    if (!relevantFiles.includes(file)) relevantFiles.push(file);
    if (relevantFiles.length >= MAX_EDIT_CONTEXT_FILES) break;
  }
  if (relevantFiles.length === 0) return selection;
  return {
    ...selection,
    relevantFiles,
    reason: `${selection.reason} Added ${planHints.length} approved-plan context hint(s).`.slice(0, 400),
  };
}

export function buildApprovedPlanEditContext(
  snapshot: ProjectSnapshot,
  executionRequest: string,
  session: ProjectSessionState | null,
  editIntent: EditIntentDelta,
  approvedPlan: ApprovedPlanExecutionContract,
): string {
  const recentEdits = session?.edits.slice(-MAX_HISTORY_CONTEXT).map((edit) => ({
    userRequest: edit.userRequest,
    assistantSummary: edit.assistantSummary,
    changedFiles: edit.changedFiles,
  })) ?? [];

  return JSON.stringify({
    followUpRequest: executionRequest,
    editIntent,
    approvedPlan,
    continuity: session
      ? {
          originalProductRequest: session.productRequest ?? null,
          designIntent: session.designIntent ?? null,
          recentEdits,
        }
      : null,
    project: {
      id: snapshot.id,
      files: snapshot.files,
    },
  });
}

function attachApprovedPlanToRepairRequest(
  repairContext: string,
  approvedPlan: ApprovedPlanExecutionContract,
): string {
  const parsed: unknown = JSON.parse(repairContext);
  if (!isRecord(parsed)) {
    throw new Error('One-shot repair context must be a JSON object.');
  }
  return JSON.stringify({ ...parsed, approvedPlan });
}

export async function buildProjectFromApprovedPlan(
  projectInput: string,
  options: BuildFromApprovedPlanOptions = {},
): Promise<ApprovedPlanBuildResult> {
  const project = await resolveGeneratedProject(projectInput, options.generatedRoot);
  const persistedPlan = await readPlanArtifactFromDirectory(project.directory, 'BUILD');
  if (!persistedPlan) {
    throw new ApprovedPlanExecutionError(
      'APPROVED_PLAN_NOT_FOUND',
      'No Plan Artifact exists for this project. Draft and approve a plan before Build.',
    );
  }
  const executionPlan = compileApprovedPlanExecutionContract(persistedPlan);
  const executionRequest = buildApprovedPlanExecutionRequest(executionPlan);
  const session = await readProjectSession(project.directory);
  const agent = createFrontendAgentRecorder(options);

  const prepared = await runFrontendAgentStage(
    agent,
    'SELECT_CONTEXT',
    `Loading approved Plan revision ${executionPlan.source.revision} and selecting execution context`,
    `Selected execution context for approved Plan revision ${executionPlan.source.revision}`,
    async () => {
      const editIntent = await resolveEditIntentDelta({
        userRequest: executionRequest,
        baselineDesignIntent: session?.designIntent ?? null,
        visualSelections: [],
      });
      const availableFiles = await listProjectContextFiles(project.directory);
      const initialSelection = await selectProjectContextFiles(
        {
          userRequest: executionRequest,
          visualSelections: [],
          editIntent: editIntent.delta,
        },
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
  );

  const { editIntent, availableFiles, contextSelection } = prepared;
  const snapshot = await runFrontendAgentStage(
    agent,
    'READ',
    'Reading only the approved-plan execution context',
    `Read ${contextSelection.relevantFiles.length} execution context file(s)`,
    () => readProjectSnapshot(project, contextSelection.relevantFiles),
  );

  const editContext = buildApprovedPlanEditContext(
    snapshot,
    executionRequest,
    session,
    editIntent.delta,
    executionPlan,
  );

  const edited = await runFrontendAgentStage(
    agent,
    'EDIT',
    `Executing approved Plan revision ${executionPlan.source.revision}`,
    `Applied approved Plan revision ${executionPlan.source.revision}`,
    async () => {
      const generation = await requestProjectPatch(editContext);
      const result = parseApprovedPlanPatch(generation.content);
      if (result.status === 'BLOCKED') {
        throw new ApprovedPlanExecutionError(
          'APPROVED_PLAN_BUILD_BLOCKED',
          `Approved Plan Build stopped before source mutation: ${result.deviations.join(' | ')}`,
          result.deviations,
        );
      }
      await assertPatchUsesSelectedContext(
        project,
        result.patch,
        contextSelection.relevantFiles,
      );
      const initialChangedFiles = await applyProjectPatch(project, result.patch);
      return {
        generation,
        patch: result.patch,
        initialChangedFiles,
      };
    },
  );

  const { generation, patch, initialChangedFiles } = edited;
  agent.emit('CHECK', 'ACTIVE', 'Checking TypeScript and build health');

  let repair: OneShotRepairResult;
  try {
    const initialProjectCheck = await checkProjectTool.execute(
      {},
      { projectDirectory: project.directory },
    );
    repair = await runOneShotRepair({
      projectId: project.id,
      userRequest: executionRequest,
      initialEditSummary: patch.summary,
      initialChangedFiles,
      selectedContextFiles: contextSelection.relevantFiles,
      availableFiles,
      initialCheck: initialProjectCheck,
      readFiles: async (paths) => (await readProjectSnapshot(project, paths)).files,
      requestRepair: (repairContext) =>
        requestProjectRepair(
          attachApprovedPlanToRepairRequest(repairContext, executionPlan),
        ),
      parsePatch: parseProjectPatch,
      applyPatch: (repairPatch) => applyProjectPatch(project, repairPatch),
      checkProject: () =>
        checkProjectTool.execute({}, { projectDirectory: project.directory }),
    });
  } catch (error) {
    agent.emit(
      'CHECK',
      'FAILED',
      `Project health check failed to complete: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }

  const changedFiles = [...new Set([...initialChangedFiles, ...repair.changedFiles])];
  const projectCheck = repair.finalCheck;
  if (projectCheck.ok && projectCheck.value.status === 'PASS') {
    agent.emit(
      'CHECK',
      'COMPLETED',
      repair.attempted
        ? 'Approved Plan is code-healthy after one bounded build repair'
        : 'Approved Plan is code-healthy',
    );
  } else {
    agent.emit(
      'CHECK',
      'FAILED',
      projectCheck.ok
        ? 'Approved Plan execution still has source errors'
        : `Project health check could not run: ${projectCheck.error.message}`,
    );
  }

  let nextSession = session;
  try {
    nextSession = await appendProjectEditHistory(project.directory, {
      userRequest: `[Approved Plan r${executionPlan.source.revision}] ${executionPlan.goal}`,
      assistantSummary: patch.summary,
      changedFiles,
      model: generation.model,
    });
  } catch (error) {
    console.warn(
      '[Yakable Approved Plan Build] Source update succeeded but conversation history could not be persisted.',
      error,
    );
  }

  return {
    projectId: project.id,
    projectDirectory: project.directory,
    model: generation.model,
    summary: patch.summary,
    changedFiles,
    editIntent,
    contextSelection,
    repair,
    projectCheck,
    agentTrace: agent.snapshot(),
    session: nextSession,
    executionPlan,
  };
}
