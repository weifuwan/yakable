import {
  parseAgentProtocolItem,
  type AgentProtocolItem,
} from '../protocol/agent-protocol.js';
import { getYakableDatabase } from './database.js';

export interface AgentRunItemRecord {
  sequence: number;
  item: AgentProtocolItem;
}

interface AgentItemRow {
  sequence: number;
  item_json: string;
}

const MAX_ITEM_JSON_BYTES = 128_000;
const MAX_RUN_SUMMARY_LENGTH = 2_000;

function parseStoredItem(row: AgentItemRow): AgentRunItemRecord {
  let value: unknown;
  try {
    value = JSON.parse(row.item_json);
  } catch {
    throw new Error('Stored agent item is not valid JSON.');
  }
  return {
    sequence: row.sequence,
    item: parseAgentProtocolItem(value),
  };
}

export function listAgentRunItems(runId: string): AgentRunItemRecord[] {
  const rows = getYakableDatabase().prepare(`
    SELECT sequence, item_json
    FROM agent_items
    WHERE run_id = ?
    ORDER BY sequence ASC, id ASC
  `).all(runId) as unknown as AgentItemRow[];
  return rows.map(parseStoredItem);
}

export function upsertAgentRunItem(
  runId: string,
  candidate: AgentProtocolItem,
): AgentRunItemRecord {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) throw new Error('Agent run id is required.');
  const item = parseAgentProtocolItem(candidate);
  const itemJson = JSON.stringify(item);
  const itemBytes = Buffer.byteLength(itemJson, 'utf8');
  if (itemBytes > MAX_ITEM_JSON_BYTES) {
    throw new Error(`Agent item is too large (${itemBytes} bytes; max ${MAX_ITEM_JSON_BYTES}).`);
  }

  const database = getYakableDatabase();
  database.exec('BEGIN IMMEDIATE');
  try {
    const existing = database.prepare(`
      SELECT sequence
      FROM agent_items
      WHERE run_id = ? AND item_id = ?
    `).get(normalizedRunId, item.id) as unknown as { sequence: number } | undefined;

    const sequence = existing?.sequence ?? (
      database.prepare(`
        SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence
        FROM agent_items
        WHERE run_id = ?
      `).get(normalizedRunId) as unknown as { sequence: number }
    ).sequence;

    database.prepare(`
      INSERT INTO agent_items (run_id, item_id, sequence, type, item_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(run_id, item_id) DO UPDATE SET
        type = excluded.type,
        item_json = excluded.item_json
    `).run(normalizedRunId, item.id, sequence, item.type, itemJson);

    // Tool/check failures can be recoverable observations. Only a failed progress
    // state is authoritative for the final run outcome. A user stop is a distinct
    // terminal state, not an Agent failure.
    if (item.type === 'progress' && item.status === 'FAILED') {
      const terminalStatus = /^stopped by user\.?$/i.test(item.message.trim())
        ? 'CANCELLED'
        : 'FAILED';
      database.prepare(`
        UPDATE agent_runs
        SET status = ?, summary = COALESCE(summary, ?), completed_at = COALESCE(completed_at, ?)
        WHERE id = ? AND status = 'RUNNING'
      `).run(
        terminalStatus,
        item.message.slice(0, MAX_RUN_SUMMARY_LENGTH),
        item.completedAt ?? item.startedAt,
        normalizedRunId,
      );
    }

    database.exec('COMMIT');
    return { sequence, item };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
