import { getYakableDatabase } from './database.js';
import type {
  WorkspaceTurnDiff,
} from '../workspace/turn-diff.js';
import type {
  WorkspaceChangeType,
  WorkspaceFileChange,
} from '../workspace/change-set.js';

interface AgentTurnDiffRow {
  files_json: string;
  unified_diff: string;
  added_lines: number;
  removed_lines: number;
}

function isChangeType(value: unknown): value is WorkspaceChangeType {
  return value === 'ADDED' || value === 'MODIFIED' || value === 'DELETED';
}

function parseFiles(raw: string): WorkspaceFileChange[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('Stored agent turn diff files must be an array.');

  return value.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new Error(`Stored agent turn diff files[${index}] is invalid.`);
    }
    const record = item as Record<string, unknown>;
    if (
      typeof record.path !== 'string' ||
      !isChangeType(record.type) ||
      (record.beforeContent !== null && typeof record.beforeContent !== 'string') ||
      (record.afterContent !== null && typeof record.afterContent !== 'string')
    ) {
      throw new Error(`Stored agent turn diff files[${index}] is invalid.`);
    }
    return {
      path: record.path,
      type: record.type,
      beforeContent: record.beforeContent as string | null,
      afterContent: record.afterContent as string | null,
    };
  });
}

export function recordAgentRunTurnDiff(
  runId: string,
  diff: WorkspaceTurnDiff,
): void {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) throw new Error('Agent run id is required for turn diff persistence.');

  getYakableDatabase().prepare(`
    INSERT INTO agent_turn_diffs (
      run_id, files_json, unified_diff, added_lines, removed_lines
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(run_id) DO UPDATE SET
      files_json = excluded.files_json,
      unified_diff = excluded.unified_diff,
      added_lines = excluded.added_lines,
      removed_lines = excluded.removed_lines
  `).run(
    normalizedRunId,
    JSON.stringify(diff.files),
    diff.unifiedDiff,
    diff.addedLines,
    diff.removedLines,
  );
}

export function readAgentRunTurnDiff(runId: string): WorkspaceTurnDiff | null {
  const row = getYakableDatabase().prepare(`
    SELECT files_json, unified_diff, added_lines, removed_lines
    FROM agent_turn_diffs
    WHERE run_id = ?
  `).get(runId) as unknown as AgentTurnDiffRow | undefined;

  if (!row) return null;
  return {
    files: parseFiles(row.files_json),
    unifiedDiff: row.unified_diff,
    addedLines: row.added_lines,
    removedLines: row.removed_lines,
  };
}
