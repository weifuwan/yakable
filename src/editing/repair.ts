import type { CheckProjectOutput } from '../tools/check-project.js';
import type { ToolResult } from '../tools/tool.js';
import type { GeneratedFile, ProjectPatch } from '../types.js';
import {
  workspaceChangedPaths,
  type WorkspaceChangeSet,
} from '../workspace/change-set.js';

export const MAX_REPAIR_CONTEXT_FILES = 12;

export type OneShotRepairStatus = 'NOT_NEEDED' | 'SKIPPED' | 'REPAIRED' | 'FAILED';

export interface OneShotRepairResult {
  attempted: boolean;
  status: OneShotRepairStatus;
  contextFiles: string[];
  changedFiles: string[];
  initialCheck: ToolResult<CheckProjectOutput>;
  finalCheck: ToolResult<CheckProjectOutput>;
  changeSet?: WorkspaceChangeSet;
  model?: string;
  summary?: string;
  error?: string;
}

export interface RepairGeneration {
  content: string;
  model: string;
}

export interface RunOneShotRepairInput {
  projectId: string;
  userRequest: string;
  initialEditSummary: string;
  initialChangedFiles: string[];
  selectedContextFiles: string[];
  availableFiles: string[];
  initialCheck: ToolResult<CheckProjectOutput>;
  readFiles(paths: string[]): Promise<GeneratedFile[]>;
  requestRepair(repairContext: string): Promise<RepairGeneration>;
  parsePatch(rawContent: string): ProjectPatch;
  applyChanges(patch: ProjectPatch): Promise<WorkspaceChangeSet>;
  checkProject(): Promise<ToolResult<CheckProjectOutput>>;
}

function addUnique(target: string[], value: string, allowed?: Set<string>): void {
  const normalized = value.trim();
  if (!normalized || target.includes(normalized)) return;
  if (allowed && !allowed.has(normalized)) return;
  if (target.length >= MAX_REPAIR_CONTEXT_FILES) return;
  target.push(normalized);
}

export function selectOneShotRepairContextFiles(
  initialChangedFiles: string[],
  projectCheck: ToolResult<CheckProjectOutput>,
  selectedContextFiles: string[],
  availableFiles: string[],
): string[] {
  const selected: string[] = [];
  const available = new Set(availableFiles.map((file) => file.trim()).filter(Boolean));
  const changed = new Set(initialChangedFiles.map((file) => file.trim()).filter(Boolean));

  for (const file of initialChangedFiles) {
    addUnique(selected, file);
  }

  if (projectCheck.ok) {
    for (const diagnostic of projectCheck.value.diagnostics) {
      if (!diagnostic.path) continue;
      const path = diagnostic.path.trim();
      if (changed.has(path)) {
        addUnique(selected, path);
      } else {
        addUnique(selected, path, available);
      }
    }
  }

  for (const file of selectedContextFiles) {
    if (changed.has(file)) {
      addUnique(selected, file);
    } else {
      addUnique(selected, file, available);
    }
  }

  return selected.slice(0, MAX_REPAIR_CONTEXT_FILES);
}

export function buildOneShotRepairRequest(
  projectId: string,
  userRequest: string,
  initialEditSummary: string,
  projectCheck: ToolResult<CheckProjectOutput>,
  files: GeneratedFile[],
): string {
  if (!projectCheck.ok || projectCheck.value.status !== 'FAIL') {
    throw new Error('One-shot repair request requires a failed project check.');
  }
  if (files.length === 0 || files.length > MAX_REPAIR_CONTEXT_FILES) {
    throw new Error(
      `One-shot repair requires between 1 and ${MAX_REPAIR_CONTEXT_FILES} context files.`,
    );
  }

  return JSON.stringify({
    userRequest: userRequest.trim(),
    initialEditSummary: initialEditSummary.trim(),
    projectCheck: projectCheck.value,
    project: {
      id: projectId,
      files,
    },
  });
}

export function assertRepairPatchUsesContext(
  patch: ProjectPatch,
  repairContextFiles: string[],
): void {
  const allowed = new Set(repairContextFiles);
  for (const change of patch.changes) {
    if (!allowed.has(change.path)) {
      throw new Error(
        `One-shot repair attempted to modify a file outside repair context: ${change.path}`,
      );
    }
  }
}

function checkExecutionFailure(error: unknown): ToolResult<CheckProjectOutput> {
  return {
    ok: false,
    error: {
      code: 'REPAIR_CHECK_FAILED',
      message: `Post-repair project check could not run: ${
        error instanceof Error ? error.message : String(error)
      }`,
    },
  };
}

export async function runOneShotRepair(
  input: RunOneShotRepairInput,
): Promise<OneShotRepairResult> {
  if (!input.initialCheck.ok) {
    return {
      attempted: false,
      status: 'SKIPPED',
      contextFiles: [],
      changedFiles: [],
      initialCheck: input.initialCheck,
      finalCheck: input.initialCheck,
      error: `Repair skipped because the initial project check could not run: ${input.initialCheck.error.message}`,
    };
  }

  if (input.initialCheck.value.status === 'PASS') {
    return {
      attempted: false,
      status: 'NOT_NEEDED',
      contextFiles: [],
      changedFiles: [],
      initialCheck: input.initialCheck,
      finalCheck: input.initialCheck,
    };
  }

  const contextFiles = selectOneShotRepairContextFiles(
    input.initialChangedFiles,
    input.initialCheck,
    input.selectedContextFiles,
    input.availableFiles,
  );

  let changeSet: WorkspaceChangeSet | undefined;
  let changedFiles: string[] = [];
  let model: string | undefined;
  let summary: string | undefined;
  let repairError: string | undefined;

  try {
    const files = await input.readFiles(contextFiles);
    const generation = await input.requestRepair(
      buildOneShotRepairRequest(
        input.projectId,
        input.userRequest,
        input.initialEditSummary,
        input.initialCheck,
        files,
      ),
    );
    model = generation.model;

    const patch = input.parsePatch(generation.content);
    assertRepairPatchUsesContext(patch, contextFiles);
    changeSet = await input.applyChanges(patch);
    changedFiles = workspaceChangedPaths(changeSet);
    summary = patch.summary;
  } catch (error) {
    repairError = error instanceof Error ? error.message : String(error);
  }

  let finalCheck: ToolResult<CheckProjectOutput>;
  try {
    finalCheck = await input.checkProject();
  } catch (error) {
    finalCheck = checkExecutionFailure(error);
  }

  const repaired =
    !repairError && finalCheck.ok && finalCheck.value.status === 'PASS';

  return {
    attempted: true,
    status: repaired ? 'REPAIRED' : 'FAILED',
    contextFiles,
    changedFiles,
    initialCheck: input.initialCheck,
    finalCheck,
    ...(changeSet ? { changeSet } : {}),
    ...(model ? { model } : {}),
    ...(summary ? { summary } : {}),
    ...(repairError ? { error: repairError } : {}),
  };
}
