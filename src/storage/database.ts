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
