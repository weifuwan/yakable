import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const databases = new Map<string, DatabaseSync>();

export function resolveYakableDatabasePath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.YAKABLE_DB_PATH?.trim();
  if (configured) return configured === ':memory:' ? configured : path.resolve(configured);
  return path.resolve(process.cwd(), 'data', 'yakable.db');
}

function initializeSchema(database: DatabaseSync): void {
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS project_sessions (
      project_id TEXT PRIMARY KEY,
      product_request TEXT,
      design_intent_json TEXT,
      initial_summary TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_edits (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      user_request TEXT NOT NULL,
      assistant_summary TEXT NOT NULL,
      changed_files_json TEXT NOT NULL DEFAULT '[]',
      model TEXT,
      FOREIGN KEY (project_id) REFERENCES project_sessions(project_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_project_edits_project_created
      ON project_edits(project_id, created_at, id);

    CREATE TABLE IF NOT EXISTS project_edit_selections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edit_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      source_id TEXT,
      file TEXT,
      line INTEGER,
      column INTEGER,
      tag_name TEXT NOT NULL,
      text TEXT NOT NULL,
      selector TEXT NOT NULL,
      FOREIGN KEY (edit_id) REFERENCES project_edits(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_project_edit_selections_edit
      ON project_edit_selections(edit_id, ordinal, id);

    CREATE TABLE IF NOT EXISTS project_lifecycle (
      project_id TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      status TEXT NOT NULL,
      active_run_id TEXT,
      failure_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_project_lifecycle_status_updated
      ON project_lifecycle(status, updated_at DESC, project_id);

    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      prompt TEXT NOT NULL,
      model TEXT,
      summary TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_agent_runs_project_started
      ON agent_runs(project_id, started_at DESC, id DESC);

    DROP TABLE IF EXISTS agent_events;

    CREATE TABLE IF NOT EXISTS agent_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      type TEXT NOT NULL,
      item_json TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE,
      UNIQUE (run_id, item_id),
      UNIQUE (run_id, sequence)
    );

    CREATE INDEX IF NOT EXISTS idx_agent_items_run_sequence
      ON agent_items(run_id, sequence, id);

    DROP TABLE IF EXISTS agent_file_changes;

    CREATE TABLE IF NOT EXISTS agent_turn_diffs (
      run_id TEXT PRIMARY KEY,
      files_json TEXT NOT NULL,
      unified_diff TEXT NOT NULL,
      added_lines INTEGER NOT NULL,
      removed_lines INTEGER NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_run_states (
      run_id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
    );
  `);
}

export function getYakableDatabase(
  databasePath = resolveYakableDatabasePath(),
): DatabaseSync {
  const key = databasePath === ':memory:' ? databasePath : path.resolve(databasePath);
  const existing = databases.get(key);
  if (existing) return existing;

  if (key !== ':memory:') {
    mkdirSync(path.dirname(key), { recursive: true });
  }

  const database = new DatabaseSync(key);
  initializeSchema(database);
  databases.set(key, database);
  return database;
}

export function closeYakableDatabases(): void {
  for (const database of databases.values()) {
    database.close();
  }
  databases.clear();
}
