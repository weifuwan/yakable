import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  assertModeCapability,
  type YakableMode,
} from '../modes/mode-contract.js';
import { resolveGeneratedProject } from '../runtime/runtime.js';
import {
  draftProjectPlan,
  parsePlanArtifact,
  readPlanArtifactFromDirectory,
  renderPlanArtifactMarkdown,
  type PlanArtifact,
  type PlanArtifactRun,
} from './plan-artifact.js';
import {
  diffPlanArtifacts,
  renderPlanDiffMarkdown,
  type PlanDiff,
} from './plan-diff.js';

export const PLAN_HISTORY_DIRECTORY = '.yakable/plans';

export interface ReplanProjectOptions {
  mode?: YakableMode;
  generatedRoot?: string;
}

export interface ReplanProjectResult extends PlanArtifactRun {
  previousPlan: PlanArtifact;
  diff: PlanDiff;
  diffMarkdown: string;
}

export interface ReadProjectPlanDiffOptions {
  mode?: YakableMode;
  generatedRoot?: string;
  fromRevision?: number;
  toRevision?: number;
}

function validateRevision(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return value;
}

function revisionName(revision: number): string {
  return `revision-${String(validateRevision(revision, 'Plan revision')).padStart(6, '0')}`;
}

function historyPaths(projectDirectory: string, revision: number) {
  const base = path.join(
    projectDirectory,
    ...PLAN_HISTORY_DIRECTORY.split('/'),
    revisionName(revision),
  );
  return {
    directory: path.dirname(base),
    jsonPath: `${base}.json`,
    markdownPath: `${base}.md`,
  };
}

async function atomicWrite(target: string, content: string): Promise<void> {
  const temporary = `${target}.${process.pid}-${Date.now()}.tmp`;
  await writeFile(temporary, content, 'utf8');
  await rename(temporary, target);
}

async function archivePlanRevisionInDirectory(
  projectDirectory: string,
  plan: PlanArtifact,
  mode: YakableMode,
): Promise<void> {
  assertModeCapability(mode, 'write-plan');
  const normalized = parsePlanArtifact(JSON.stringify(plan));
  const paths = historyPaths(projectDirectory, normalized.revision);
  await mkdir(paths.directory, { recursive: true });
  await atomicWrite(paths.jsonPath, `${JSON.stringify(normalized, null, 2)}\n`);
  await atomicWrite(paths.markdownPath, renderPlanArtifactMarkdown(normalized));
}

async function readArchivedPlanRevisionInDirectory(
  projectDirectory: string,
  revision: number,
  mode: YakableMode,
): Promise<PlanArtifact | null> {
  assertModeCapability(mode, 'read-plan');
  const { jsonPath } = historyPaths(projectDirectory, revision);
  const content = await readFile(jsonPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  return content === null ? null : parsePlanArtifact(content);
}

export async function archivePlanRevision(
  projectInput: string,
  plan: PlanArtifact,
  options: ReplanProjectOptions = {},
): Promise<void> {
  const mode = options.mode ?? 'PLAN';
  assertModeCapability(mode, 'write-plan');
  const project = await resolveGeneratedProject(projectInput, options.generatedRoot);
  return archivePlanRevisionInDirectory(project.directory, plan, mode);
}

export async function readArchivedPlanRevision(
  projectInput: string,
  revision: number,
  options: ReplanProjectOptions = {},
): Promise<PlanArtifact | null> {
  const mode = options.mode ?? 'PLAN';
  assertModeCapability(mode, 'read-plan');
  const project = await resolveGeneratedProject(projectInput, options.generatedRoot);
  return readArchivedPlanRevisionInDirectory(project.directory, revision, mode);
}

export async function readProjectPlanRevision(
  projectInput: string,
  revision: number,
  options: ReplanProjectOptions = {},
): Promise<PlanArtifact | null> {
  const mode = options.mode ?? 'PLAN';
  assertModeCapability(mode, 'read-plan');
  const targetRevision = validateRevision(revision, 'Plan revision');
  const project = await resolveGeneratedProject(projectInput, options.generatedRoot);
  const current = await readPlanArtifactFromDirectory(project.directory, mode);
  if (current?.revision === targetRevision) return current;
  return readArchivedPlanRevisionInDirectory(project.directory, targetRevision, mode);
}

export async function replanProjectPlan(
  projectInput: string,
  userRequest: string,
  options: ReplanProjectOptions = {},
): Promise<ReplanProjectResult> {
  const mode = options.mode ?? 'PLAN';
  assertModeCapability(mode, 'diff-plan');
  assertModeCapability(mode, 'read-plan');
  assertModeCapability(mode, 'write-plan');

  const project = await resolveGeneratedProject(projectInput, options.generatedRoot);
  const previousPlan = await readPlanArtifactFromDirectory(project.directory, mode);
  if (!previousPlan) {
    throw new Error('Re-plan requires an existing Plan Artifact. Draft the first plan before re-planning.');
  }

  // Preserve the exact superseded revision before draftProjectPlan replaces plan.json.
  await archivePlanRevisionInDirectory(project.directory, previousPlan, mode);

  const next = await draftProjectPlan(projectInput, userRequest, {
    mode,
    generatedRoot: options.generatedRoot,
  });
  if (next.plan.revision !== previousPlan.revision + 1) {
    throw new Error(
      `Re-plan produced unexpected revision ${next.plan.revision}; expected ${previousPlan.revision + 1}.`,
    );
  }

  const diff = diffPlanArtifacts(previousPlan, next.plan);
  return {
    ...next,
    previousPlan,
    diff,
    diffMarkdown: renderPlanDiffMarkdown(diff),
  };
}

export async function readProjectPlanDiff(
  projectInput: string,
  options: ReadProjectPlanDiffOptions = {},
): Promise<{ diff: PlanDiff; markdown: string } | null> {
  const mode = options.mode ?? 'PLAN';
  assertModeCapability(mode, 'diff-plan');
  assertModeCapability(mode, 'read-plan');
  const project = await resolveGeneratedProject(projectInput, options.generatedRoot);
  const current = await readPlanArtifactFromDirectory(project.directory, mode);
  if (!current) return null;

  const toRevision = options.toRevision === undefined
    ? current.revision
    : validateRevision(options.toRevision, 'toRevision');
  const toPlan = toRevision === current.revision
    ? current
    : await readArchivedPlanRevisionInDirectory(project.directory, toRevision, mode);
  if (!toPlan) {
    throw new Error(`Plan revision ${toRevision} is not available.`);
  }

  const defaultFrom = toRevision > 1 ? toRevision - 1 : null;
  const fromRevision = options.fromRevision === undefined
    ? defaultFrom
    : validateRevision(options.fromRevision, 'fromRevision');
  const fromPlan = fromRevision === null
    ? null
    : fromRevision === current.revision
      ? current
      : await readArchivedPlanRevisionInDirectory(project.directory, fromRevision, mode);

  if (fromRevision !== null && !fromPlan) {
    const diff = diffPlanArtifacts(null, toPlan);
    return { diff, markdown: renderPlanDiffMarkdown(diff) };
  }
  if (fromPlan && fromPlan.revision >= toPlan.revision) {
    throw new Error('Plan Diff requires fromRevision to be older than toRevision.');
  }

  const diff = diffPlanArtifacts(fromPlan, toPlan);
  return { diff, markdown: renderPlanDiffMarkdown(diff) };
}
