import {
  createAgentRun,
  failAgentRun,
  type AgentRunRecord,
} from './agent-run.js';
import { getYakableDatabase } from './database.js';

export type ProjectLifecycleStatus =
  | 'CREATING'
  | 'GENERATING'
  | 'STARTING_RUNTIME'
  | 'READY'
  | 'FAILED';

export interface ProjectLifecycleRecord {
  projectId: string;
  prompt: string;
  status: ProjectLifecycleStatus;
  activeRunId?: string;
  failureMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectLifecycleInput {
  projectId: string;
  prompt: string;
  createdAt?: string;
}

export interface ProjectLifecycleTransitionInput {
  activeRunId?: string;
  failureMessage?: string;
  updatedAt?: string;
}

export interface ProjectBuildLifecycle {
  project: ProjectLifecycleRecord;
  run: AgentRunRecord;
}

interface ProjectLifecycleRow {
  project_id: string;
  prompt: string;
  status: string;
  active_run_id: string | null;
  failure_message: string | null;
  created_at: string;
  updated_at: string;
}

const MAX_PROJECT_ID_LENGTH = 240;
const MAX_PROMPT_LENGTH = 12_000;
const MAX_FAILURE_MESSAGE_LENGTH = 2_000;

const allowedTransitions: Record<ProjectLifecycleStatus, ReadonlySet<ProjectLifecycleStatus>> = {
  CREATING: new Set(['CREATING', 'GENERATING', 'FAILED']),
  GENERATING: new Set(['GENERATING', 'STARTING_RUNTIME', 'FAILED']),
  STARTING_RUNTIME: new Set(['STARTING_RUNTIME', 'READY', 'FAILED']),
  READY: new Set(['READY']),
  FAILED: new Set(['FAILED']),
};

function normalizedText(value: string, maxLength: number, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized.slice(0, maxLength);
}

function optionalText(value: string | undefined, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function isProjectLifecycleStatus(value: string): value is ProjectLifecycleStatus {
  return (
    value === 'CREATING'
    || value === 'GENERATING'
    || value === 'STARTING_RUNTIME'
    || value === 'READY'
    || value === 'FAILED'
  );
}

function lifecycleFromRow(row: ProjectLifecycleRow): ProjectLifecycleRecord {
  if (!isProjectLifecycleStatus(row.status)) {
    throw new Error(
      `Stored project lifecycle ${row.project_id} contains unsupported status ${row.status}.`,
    );
  }
  return {
    projectId: row.project_id,
    prompt: row.prompt,
    status: row.status,
    ...(row.active_run_id ? { activeRunId: row.active_run_id } : {}),
    ...(row.failure_message ? { failureMessage: row.failure_message } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createProjectLifecycle(
  input: CreateProjectLifecycleInput,
): ProjectLifecycleRecord {
  const projectId = normalizedText(
    input.projectId,
    MAX_PROJECT_ID_LENGTH,
    'Project lifecycle project id',
  );
  const prompt = normalizedText(input.prompt, MAX_PROMPT_LENGTH, 'Project lifecycle prompt');
  const createdAt = input.createdAt ?? new Date().toISOString();

  getYakableDatabase().prepare(`
    INSERT INTO project_lifecycle (
      project_id, prompt, status, active_run_id, failure_message, created_at, updated_at
    ) VALUES (?, ?, 'CREATING', NULL, NULL, ?, ?)
  `).run(projectId, prompt, createdAt, createdAt);

  return {
    projectId,
    prompt,
    status: 'CREATING',
    createdAt,
    updatedAt: createdAt,
  };
}

export function readProjectLifecycle(projectId: string): ProjectLifecycleRecord | null {
  const normalizedProjectId = normalizedText(
    projectId,
    MAX_PROJECT_ID_LENGTH,
    'Project lifecycle project id',
  );
  const row = getYakableDatabase().prepare(`
    SELECT
      project_id,
      prompt,
      status,
      active_run_id,
      failure_message,
      created_at,
      updated_at
    FROM project_lifecycle
    WHERE project_id = ?
  `).get(normalizedProjectId) as unknown as ProjectLifecycleRow | undefined;
  return row ? lifecycleFromRow(row) : null;
}

export function listActiveProjectLifecycles(): ProjectLifecycleRecord[] {
  const rows = getYakableDatabase().prepare(`
    SELECT
      project_id,
      prompt,
      status,
      active_run_id,
      failure_message,
      created_at,
      updated_at
    FROM project_lifecycle
    WHERE status IN ('CREATING', 'GENERATING', 'STARTING_RUNTIME')
    ORDER BY updated_at ASC, project_id ASC
  `).all() as unknown as ProjectLifecycleRow[];
  return rows.map(lifecycleFromRow);
}

export function transitionProjectLifecycle(
  projectId: string,
  status: ProjectLifecycleStatus,
  input: ProjectLifecycleTransitionInput = {},
): ProjectLifecycleRecord {
  const current = readProjectLifecycle(projectId);
  if (!current) throw new Error(`Project lifecycle does not exist: ${projectId}`);
  if (!allowedTransitions[current.status].has(status)) {
    throw new Error(`Invalid project lifecycle transition: ${current.status} -> ${status}`);
  }

  const activeRunId = optionalText(input.activeRunId, 240);
  const failureMessage =
    status === 'FAILED'
      ? optionalText(input.failureMessage, MAX_FAILURE_MESSAGE_LENGTH)
        ?? current.failureMessage
        ?? 'Project creation failed.'
      : undefined;
  const updatedAt = input.updatedAt ?? new Date().toISOString();

  getYakableDatabase().prepare(`
    UPDATE project_lifecycle
    SET
      status = ?,
      active_run_id = COALESCE(?, active_run_id),
      failure_message = ?,
      updated_at = ?
    WHERE project_id = ?
  `).run(status, activeRunId ?? null, failureMessage ?? null, updatedAt, current.projectId);

  const updated = readProjectLifecycle(current.projectId);
  if (!updated) throw new Error(`Project lifecycle disappeared while updating: ${current.projectId}`);
  return updated;
}

export function beginProjectBuildLifecycle(
  input: CreateProjectLifecycleInput,
): ProjectBuildLifecycle {
  const database = getYakableDatabase();
  database.exec('BEGIN IMMEDIATE');
  try {
    const project = createProjectLifecycle(input);
    const run = createAgentRun({
      projectId: project.projectId,
      kind: 'CREATE',
      prompt: project.prompt,
      startedAt: project.createdAt,
    });
    const linkedProject = transitionProjectLifecycle(project.projectId, 'CREATING', {
      activeRunId: run.id,
      updatedAt: project.createdAt,
    });
    database.exec('COMMIT');
    return { project: linkedProject, run };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function failProjectLifecycle(
  projectId: string,
  failure: unknown,
): ProjectLifecycleRecord {
  const message =
    failure instanceof Error
      ? failure.message
      : typeof failure === 'string'
        ? failure
        : 'Project creation failed.';
  const failed = transitionProjectLifecycle(projectId, 'FAILED', {
    failureMessage: message,
  });
  if (failed.activeRunId) {
    failAgentRun(failed.activeRunId, { summary: failed.failureMessage });
  }
  return failed;
}

export function deleteProjectLifecycle(projectId: string): void {
  const normalizedProjectId = normalizedText(
    projectId,
    MAX_PROJECT_ID_LENGTH,
    'Project lifecycle project id',
  );
  getYakableDatabase().prepare(
    'DELETE FROM project_lifecycle WHERE project_id = ?',
  ).run(normalizedProjectId);
}
