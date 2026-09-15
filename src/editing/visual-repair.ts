import { requestVisualRepair } from '../model/capabilities.js';
import { defaultModelClient } from '../model/default-client.js';
import type { ModelClient } from '../model/model-client.js';
import type { AgentProtocolRecorder } from '../protocol/agent-recorder.js';
import type { PageObservation } from '../runtime/page-observation.js';
import { resolveGeneratedProject, type ResolvedGeneratedProject } from '../runtime/runtime.js';
import { checkProjectTool, type CheckProjectOutput } from '../tools/check-project.js';
import type { ToolResult } from '../tools/tool.js';
import type { DesignIntentIR, GeneratedFile, ProjectPatch } from '../types.js';
import {
  workspaceChangedPaths,
  type WorkspaceChangeSet,
} from '../workspace/change-set.js';
import type { DesignCriticResult } from './design-critic.js';
import type { EditIntentDelta } from './edit-intent.js';
import {
  applyProjectChanges,
  createProjectChangeManager,
  parseProjectPatch,
} from './project-change.js';
import {
  listProjectContextFiles,
  readProjectSnapshot,
} from './project-context.js';

export const MAX_VISUAL_REPAIR_CONTEXT_FILES = 12;
export const MAX_VISUAL_REPAIR_REQUEST_CHARS = 900_000;
const MAX_VISUAL_REPAIR_USER_REQUEST = 8_000;

export type VisualRepairStatus = 'NOT_NEEDED' | 'SKIPPED' | 'REPAIRED' | 'FAILED';

export interface VisualRepairResult {
  attempted: boolean;
  status: VisualRepairStatus;
  contextFiles: string[];
  changedFiles: string[];
  projectCheck: ToolResult<CheckProjectOutput> | null;
  rolledBack: boolean;
  model?: string;
  summary?: string;
  error?: string;
}

export interface VisualRepairExecutionResult extends VisualRepairResult {
  changeSet?: WorkspaceChangeSet;
}

export interface VisualRepairGeneration {
  content: string;
  model: string;
}

export interface VisualRepairProjectInput {
  userRequest: string;
  baselineDesignIntent: DesignIntentIR | null;
  editIntent: EditIntentDelta;
  critique: DesignCriticResult;
  pageObservation: PageObservation;
  initialChangedFiles: string[];
  selectedContextFiles: string[];
}

export interface RepairGeneratedProjectVisualOptions {
  generatedRoot?: string;
  agent?: AgentProtocolRecorder;
  modelClient?: ModelClient;
  readFiles?: (
    project: ResolvedGeneratedProject,
    paths: string[],
    agent?: AgentProtocolRecorder,
  ) => Promise<GeneratedFile[]>;
  checkProject?: (
    project: ResolvedGeneratedProject,
    agent?: AgentProtocolRecorder,
  ) => Promise<ToolResult<CheckProjectOutput>>;
}

export interface RunVisualRepairInput extends VisualRepairProjectInput {
  projectId: string;
  availableFiles: string[];
  readFiles(paths: string[]): Promise<GeneratedFile[]>;
  requestRepair(request: string): Promise<VisualRepairGeneration>;
  parsePatch(rawContent: string): ProjectPatch;
  applyChanges(patch: ProjectPatch): Promise<WorkspaceChangeSet>;
  checkProject(): Promise<ToolResult<CheckProjectOutput>>;
  rollback(changeSet: WorkspaceChangeSet): Promise<void>;
}

function addUnique(target: string[], value: string, allowed: Set<string>): void {
  const normalized = value.trim();
  if (!normalized || !allowed.has(normalized) || target.includes(normalized)) return;
  if (target.length >= MAX_VISUAL_REPAIR_CONTEXT_FILES) return;
  target.push(normalized);
}

function evidenceSourceFile(ref: string, observation: PageObservation): string | null {
  const match = ref.match(/^element:(\d+)$/);
  if (!match) return null;
  const index = Number(match[1]);
  if (!Number.isInteger(index) || index < 0) return null;
  return observation.elements[index]?.source?.file?.trim() || null;
}

export function selectVisualRepairContextFiles(
  critique: DesignCriticResult,
  observation: PageObservation,
  initialChangedFiles: string[],
  selectedContextFiles: string[],
  availableFiles: string[],
): string[] {
  if (critique.status !== 'FAIL') return [];

  const available = new Set(availableFiles.map((file) => file.trim()).filter(Boolean));
  const selected: string[] = [];
  const findings = [
    ...critique.findings.filter((finding) => finding.severity === 'major'),
    ...critique.findings.filter((finding) => finding.severity === 'minor'),
  ];

  for (const finding of findings) {
    for (const ref of finding.evidenceRefs) {
      const file = evidenceSourceFile(ref, observation);
      if (file) addUnique(selected, file, available);
    }
  }

  for (const file of initialChangedFiles) addUnique(selected, file, available);
  for (const file of selectedContextFiles) addUnique(selected, file, available);
  return selected.slice(0, MAX_VISUAL_REPAIR_CONTEXT_FILES);
}

function validateUserRequest(userRequest: string): string {
  const request = userRequest.trim();
  if (!request) throw new Error('Visual Repair requires the original edit request.');
  if (request.length > MAX_VISUAL_REPAIR_USER_REQUEST) {
    throw new Error(`Visual Repair user request is too long (max ${MAX_VISUAL_REPAIR_USER_REQUEST} characters).`);
  }
  return request;
}

export function buildVisualRepairRequest(
  projectId: string,
  userRequest: string,
  baselineDesignIntent: DesignIntentIR | null,
  editIntent: EditIntentDelta,
  critique: DesignCriticResult,
  pageObservation: PageObservation,
  files: GeneratedFile[],
): string {
  if (critique.status !== 'FAIL') throw new Error('Visual Repair requires a failed Design Critic result.');
  if (files.length === 0 || files.length > MAX_VISUAL_REPAIR_CONTEXT_FILES) {
    throw new Error(`Visual Repair requires between 1 and ${MAX_VISUAL_REPAIR_CONTEXT_FILES} context files.`);
  }

  const request = JSON.stringify({
    userRequest: validateUserRequest(userRequest),
    baselineDesignIntent,
    editIntent,
    critique,
    pageObservation,
    project: { id: projectId, files },
  });
  if (request.length > MAX_VISUAL_REPAIR_REQUEST_CHARS) {
    throw new Error(`Visual Repair request is too large (max ${MAX_VISUAL_REPAIR_REQUEST_CHARS} characters).`);
  }
  return request;
}

export function assertVisualRepairPatchUsesContext(
  patch: ProjectPatch,
  contextFiles: string[],
): void {
  const allowed = new Set(contextFiles);
  for (const change of patch.changes) {
    if (!allowed.has(change.path)) {
      throw new Error(`Visual Repair attempted to modify a file outside repair context: ${change.path}`);
    }
  }
}

function checkExecutionFailure(error: unknown): ToolResult<CheckProjectOutput> {
  return {
    ok: false,
    error: {
      code: 'VISUAL_REPAIR_CHECK_FAILED',
      message: `Post-visual-repair project check could not run: ${error instanceof Error ? error.message : String(error)}`,
    },
  };
}

export async function runVisualRepairOnce(
  input: RunVisualRepairInput,
): Promise<VisualRepairExecutionResult> {
  validateUserRequest(input.userRequest);

  if (input.critique.status === 'PASS') {
    return {
      attempted: false,
      status: 'NOT_NEEDED',
      contextFiles: [],
      changedFiles: [],
      projectCheck: null,
      rolledBack: false,
    };
  }

  const contextFiles = selectVisualRepairContextFiles(
    input.critique,
    input.pageObservation,
    input.initialChangedFiles,
    input.selectedContextFiles,
    input.availableFiles,
  );

  if (contextFiles.length === 0) {
    return {
      attempted: false,
      status: 'SKIPPED',
      contextFiles: [],
      changedFiles: [],
      projectCheck: null,
      rolledBack: false,
      error: 'Visual Repair skipped because no bounded readable source context could be derived.',
    };
  }

  let changeSet!: WorkspaceChangeSet;
  let changedFiles: string[] = [];
  let model: string | undefined;
  let summary: string | undefined;

  try {
    const files = await input.readFiles(contextFiles);
    const generation = await input.requestRepair(
      buildVisualRepairRequest(
        input.projectId,
        input.userRequest,
        input.baselineDesignIntent,
        input.editIntent,
        input.critique,
        input.pageObservation,
        files,
      ),
    );
    model = generation.model;

    const patch = input.parsePatch(generation.content);
    assertVisualRepairPatchUsesContext(patch, contextFiles);
    changeSet = await input.applyChanges(patch);
    changedFiles = workspaceChangedPaths(changeSet);
    summary = patch.summary;
  } catch (error) {
    return {
      attempted: true,
      status: 'FAILED',
      contextFiles,
      changedFiles,
      projectCheck: null,
      rolledBack: false,
      ...(model ? { model } : {}),
      ...(summary ? { summary } : {}),
      error: error instanceof Error ? error.message : String(error),
    };
  }

  let projectCheck: ToolResult<CheckProjectOutput>;
  try {
    projectCheck = await input.checkProject();
  } catch (error) {
    projectCheck = checkExecutionFailure(error);
  }

  const repaired = projectCheck.ok && projectCheck.value.status === 'PASS';
  if (repaired) {
    return {
      attempted: true,
      status: 'REPAIRED',
      contextFiles,
      changedFiles,
      projectCheck,
      rolledBack: false,
      changeSet,
      ...(model ? { model } : {}),
      ...(summary ? { summary } : {}),
    };
  }

  let rolledBack = false;
  let rollbackError: string | undefined;
  try {
    await input.rollback(changeSet);
    rolledBack = true;
  } catch (error) {
    rollbackError = error instanceof Error ? error.message : String(error);
  }

  const checkError = projectCheck.ok
    ? 'Visual Repair changed source but the fixed project health check still failed.'
    : projectCheck.error.message;

  return {
    attempted: true,
    status: 'FAILED',
    contextFiles,
    changedFiles,
    projectCheck,
    rolledBack,
    changeSet,
    ...(model ? { model } : {}),
    ...(summary ? { summary } : {}),
    error: rollbackError
      ? `${checkError} Rollback also failed: ${rollbackError}`
      : `${checkError} The visual-repair ChangeSet was rolled back.`,
  };
}

export async function repairGeneratedProjectVisual(
  projectInput: string,
  input: VisualRepairProjectInput,
  options: RepairGeneratedProjectVisualOptions = {},
): Promise<VisualRepairExecutionResult> {
  const project = await resolveGeneratedProject(projectInput, options.generatedRoot);
  const availableFiles = await listProjectContextFiles(project.directory);
  const changeManager = createProjectChangeManager(project);
  const modelClient = options.modelClient ?? defaultModelClient;

  return runVisualRepairOnce({
    ...input,
    projectId: project.id,
    availableFiles,
    readFiles: async (paths) => options.readFiles
      ? options.readFiles(project, paths, options.agent)
      : (await readProjectSnapshot(project, paths)).files,
    requestRepair: (request) => requestVisualRepair(modelClient, request),
    parsePatch: parseProjectPatch,
    applyChanges: (patch) => applyProjectChanges(changeManager, patch, options.agent),
    checkProject: () => options.checkProject
      ? options.checkProject(project, options.agent)
      : checkProjectTool.execute({}, { projectDirectory: project.directory, agent: options.agent }),
    rollback: (changeSet) => changeManager.rollback(changeSet),
  });
}
