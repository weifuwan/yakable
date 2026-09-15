import { getYakableDatabase } from './database.js';

const MAX_STATE_JSON_BYTES = 512_000;

export function writeAgentRunState<T>(runId: string, state: T): void {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) throw new Error('Agent run id is required.');

  const stateJson = JSON.stringify(state);
  const bytes = Buffer.byteLength(stateJson, 'utf8');
  if (bytes > MAX_STATE_JSON_BYTES) {
    throw new Error(`Agent run state is too large (${bytes} bytes; max ${MAX_STATE_JSON_BYTES}).`);
  }

  getYakableDatabase().prepare(`
    INSERT INTO agent_run_states (run_id, state_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(run_id) DO UPDATE SET
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
  `).run(normalizedRunId, stateJson, new Date().toISOString());
}

export function readAgentRunState<T>(runId: string): T | null {
  const row = getYakableDatabase().prepare(`
    SELECT state_json
    FROM agent_run_states
    WHERE run_id = ?
  `).get(runId.trim()) as unknown as { state_json: string } | undefined;

  if (!row) return null;
  try {
    return JSON.parse(row.state_json) as T;
  } catch {
    throw new Error(`Stored agent run state is not valid JSON: ${runId}`);
  }
}

export function deleteAgentRunState(runId: string): void {
  getYakableDatabase().prepare('DELETE FROM agent_run_states WHERE run_id = ?').run(runId.trim());
}
