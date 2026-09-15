import { randomUUID } from 'node:crypto';

import type { AgentProtocolItem } from '../protocol/agent-protocol.js';
import type { WorkspaceFileChange } from '../workspace/change-set.js';
import type { WorkspaceTurnDiff } from '../workspace/turn-diff.js';
import {
  listAgentRunItems,
  upsertAgentRunItem,
  type AgentRunItemRecord,
} from './agent-run-item.js';
import { readAgentRunTurnDiff } from './agent-run-turn-diff.js';
import { getYakableDatabase } from './database.js';

export type AgentRunKind = 'CREATE' | 'EDIT';
export type AgentRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface AgentRunChangeView extends WorkspaceFileChange {
  ordinal: number;
}

export interface AgentRunRecord {
  id: string;
  projectId: string;
  kind: AgentRunKind;
  status: AgentRunStatus;
  prompt: string;
  model?: string;
  summary?: string;
  startedAt: string;
  completedAt?: string;
  items: AgentProtocolItem[];
  turnDiff: WorkspaceTurnDiff | null;
  /** Dashboard projection; source of truth is turnDiff. */
  changes: AgentRunChangeView[];
}

export interface CreateAgentRunInput {
  projectId: string;
  kind: AgentRunKind;
  prompt: string;
  startedAt?: string;
}

export interface CompleteAgentRunInput {
  model?: string;
  summary?: string;
  completedAt?: string;
}

export interface FailAgentRunInput {
  summary?: string;
  completedAt?: string;
}

interface AgentRunRow {
  id: string;
  project_id: string;
  kind: string;
  status: string;
  prompt: string;
  model: string | null;
  summary: string | null;
  started_at: string;
  completed_at: string | null;
}

const MAX_PROJECT_ID_LENGTH = 240;
const MAX_PROMPT_LENGTH = 12_000;
const MAX_MODEL_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 2_000;
const MAX_RUNS_PER_PROJECT = 100;

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

function isAgentRunKind(value: string): value is AgentRunKind {
  return value === 'CREATE' || value === 'EDIT';
}

function isAgentRunStatus(value: string): value is AgentRunStatus {
  return value === 'RUNNING' || value === 'COMPLETED' || value === 'FAILED';
}

function runFromRow(row: AgentRunRow): AgentRunRecord {
  if (!isAgentRunKind(row.kind) || !isAgentRunStatus(row.status)) {
    throw new Error(`Stored agent run ${row.id} contains an unsupported kind or status.`);
  }
  const turnDiff = readAgentRunTurnDiff(row.id);
  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind,
    status: row.status,
    prompt: row.prompt,
    ...(row.model ? { model: row.model } : {}),
    ...(row.summary ? { summary: row.summary } : {}),
    startedAt: row.started_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    items: listAgentRunItems(row.id).map((record) => record.item),
    turnDiff,
    changes: turnDiff?.files.map((file, index) => ({ ...file, ordinal: index + 1 })) ?? [],
  };
}

export function createAgentRun(input: CreateAgentRunInput): AgentRunRecord {
  const id = randomUUID();
  const startedAt = input.startedAt ?? new Date().toISOString();
  const projectId = normalizedText(input.projectId, MAX_PROJECT_ID_LENGTH, 'Agent run project id');
  const prompt = normalizedText(input.prompt, MAX_PROMPT_LENGTH, 'Agent run prompt');

  getYakableDatabase().prepare(`
    INSERT INTO agent_runs (
      id, project_id, kind, status, prompt, model, summary, started_at, completed_at
    ) VALUES (?, ?, ?, 'RUNNING', ?, NULL, NULL, ?, NULL)
  `).run(id, projectId, input.kind, prompt, startedAt);

  return {
    id,
    projectId,
    kind: input.kind,
    status: 'RUNNING',
    prompt,
    startedAt,
    items: [],
    turnDiff: null,
    changes: [],
  };
}

export function appendAgentRunEvent(
  runId: string,
  item: AgentProtocolItem,
): AgentRunItemRecord {
  return upsertAgentRunItem(runId, item);
}

export function completeAgentRun(runId: string, input: CompleteAgentRunInput = {}): void {
  const model = optionalText(input.model, MAX_MODEL_LENGTH);
  const summary = optionalText(input.summary, MAX_SUMMARY_LENGTH);
  const completedAt = input.completedAt ?? new Date().toISOString();

  getYakableDatabase().prepare(`
    UPDATE agent_runs
    SET
      status = CASE WHEN status = 'RUNNING' THEN 'COMPLETED' ELSE status END,
      model = COALESCE(?, model),
      summary = COALESCE(?, summary),
      completed_at = COALESCE(completed_at, ?)
    WHERE id = ?
  `).run(model ?? null, summary ?? null, completedAt, runId);
}

export function failAgentRun(runId: string, input: FailAgentRunInput = {}): void {
  const summary = optionalText(input.summary, MAX_SUMMARY_LENGTH);
  const completedAt = input.completedAt ?? new Date().toISOString();

  getYakableDatabase().prepare(`
    UPDATE agent_runs
    SET
      status = CASE WHEN status = 'RUNNING' THEN 'FAILED' ELSE status END,
      summary = COALESCE(?, summary),
      completed_at = COALESCE(completed_at, ?)
    WHERE id = ?
  `).run(summary ?? null, completedAt, runId);
}

export function readAgentRun(runId: string): AgentRunRecord | null {
  const row = getYakableDatabase().prepare(`
    SELECT id, project_id, kind, status, prompt, model, summary, started_at, completed_at
    FROM agent_runs
    WHERE id = ?
  `).get(runId) as unknown as AgentRunRow | undefined;
  return row ? runFromRow(row) : null;
}

export function listProjectAgentRuns(projectId: string, limit = 40): AgentRunRecord[] {
  const normalizedProjectId = normalizedText(
    projectId,
    MAX_PROJECT_ID_LENGTH,
    'Agent run project id',
  );
  const normalizedLimit = Number.isInteger(limit)
    ? Math.min(Math.max(limit, 1), MAX_RUNS_PER_PROJECT)
    : 40;

  const rows = getYakableDatabase().prepare(`
    SELECT id, project_id, kind, status, prompt, model, summary, started_at, completed_at
    FROM agent_runs
    WHERE project_id = ?
    ORDER BY started_at DESC, id DESC
    LIMIT ?
  `).all(normalizedProjectId, normalizedLimit) as unknown as AgentRunRow[];

  return rows.map(runFromRow);
}

export function deleteProjectAgentRuns(projectId: string): void {
  getYakableDatabase().prepare('DELETE FROM agent_runs WHERE project_id = ?').run(projectId);
}
