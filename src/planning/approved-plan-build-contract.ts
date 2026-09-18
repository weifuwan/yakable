import {
  MAX_EDIT_CONTEXT_FILES,
  type EditContextSelection,
} from '../editing/context-selection.js';
import type { EditIntentDelta } from '../editing/edit-intent.js';
import { parseProjectPatch } from '../editing/project-change.js';
import {
  buildProjectContinuityContext,
  type ProjectSnapshot,
} from '../editing/project-context.js';
import type { ProjectPatch, ProjectSessionState } from '../types.js';
import {
  collectApprovedPlanContextHints,
  type ApprovedPlanExecutionContract,
} from './approved-plan-contract.js';

export const MAX_APPROVED_PLAN_DEVIATION_LENGTH = 600;

export type ApprovedPlanPatchResult =
  | { status: 'APPLIED'; summary: string; deviations: []; patch: ProjectPatch }
  | { status: 'BLOCKED'; summary: string; deviations: string[] };

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
  const patch = parseProjectPatch(JSON.stringify({ summary, changes: value.changes }));
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
  return JSON.stringify({
    followUpRequest: executionRequest,
    editIntent,
    approvedPlan,
    continuity: session ? buildProjectContinuityContext(session) : null,
    project: { id: snapshot.id, files: snapshot.files },
  });
}

export function attachApprovedPlanToRepairRequest(
  repairContext: string,
  approvedPlan: ApprovedPlanExecutionContract,
): string {
  const parsed: unknown = JSON.parse(repairContext);
  if (!isRecord(parsed)) {
    throw new Error('One-shot repair context must be a JSON object.');
  }
  return JSON.stringify({ ...parsed, approvedPlan });
}
