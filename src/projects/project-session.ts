import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { getYakableDatabase } from '../storage/database.js';
import type {
  DesignIntentIR,
  ProjectConversation,
  ProjectConversationMessage,
  ProjectEditHistoryItem,
  ProjectSessionState,
  ProjectVisualSelection,
} from '../types.js';

const SESSION_DIRECTORY = '.yakable';
const SESSION_FILENAME = 'session.json';
const MAX_EDIT_HISTORY = 40;
const MAX_REQUEST_LENGTH = 8_000;
const MAX_SUMMARY_LENGTH = 2_000;
const MAX_CHANGED_FILES = 12;
const MAX_VISUAL_SELECTIONS = 20;

interface SessionRow {
  project_id: string;
  product_request: string | null;
  design_intent_json: string | null;
  initial_summary: string | null;
  created_at: string;
  updated_at: string;
}

interface EditRow {
  id: string;
  created_at: string;
  user_request: string;
  assistant_summary: string;
  changed_files_json: string;
  model: string | null;
}

interface SelectionRow {
  source_id: string | null;
  file: string | null;
  line: number | null;
  column: number | null;
  tag_name: string;
  text: string;
  selector: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function projectIdForDirectory(projectDirectory: string): string {
  return path.basename(path.resolve(projectDirectory));
}

function normalizeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function normalizeChangedFiles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const files: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== 'string') continue;
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    files.push(normalized);
    if (files.length >= MAX_CHANGED_FILES) break;
  }

  return files;
}

function normalizeVisualSelection(value: unknown): ProjectVisualSelection | null {
  if (!isRecord(value)) return null;

  const tagName = normalizeText(value.tagName, 80);
  const text = typeof value.text === 'string' ? value.text.trim().slice(0, 180) : '';
  const selector = typeof value.selector === 'string' ? value.selector.trim().slice(0, 320) : '';
  if (!tagName) return null;

  const sourceId = normalizeText(value.sourceId, 120);
  const file = normalizeText(value.file, 240);
  const line = typeof value.line === 'number' && Number.isInteger(value.line) && value.line > 0
    ? value.line
    : undefined;
  const column = typeof value.column === 'number' && Number.isInteger(value.column) && value.column > 0
    ? value.column
    : undefined;

  return {
    ...(sourceId ? { sourceId } : {}),
    ...(file ? { file } : {}),
    ...(line ? { line } : {}),
    ...(column ? { column } : {}),
    tagName,
    text,
    selector,
  };
}

function normalizeVisualSelections(value: unknown): ProjectVisualSelection[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_VISUAL_SELECTIONS)
    .map(normalizeVisualSelection)
    .filter((selection): selection is ProjectVisualSelection => Boolean(selection));
}

function normalizeEdit(value: unknown): ProjectEditHistoryItem | null {
  if (!isRecord(value)) return null;

  const userRequest = normalizeText(value.userRequest, MAX_REQUEST_LENGTH);
  const assistantSummary = normalizeText(value.assistantSummary, MAX_SUMMARY_LENGTH);
  if (!userRequest || !assistantSummary) return null;

  const model = normalizeText(value.model, 200);
  const visualSelections = normalizeVisualSelections(value.visualSelections);
  return {
    id: normalizeText(value.id, 80) ?? randomUUID(),
    createdAt: normalizeText(value.createdAt, 40) ?? new Date().toISOString(),
    userRequest,
    assistantSummary,
    changedFiles: normalizeChangedFiles(value.changedFiles),
    ...(model ? { model } : {}),
    ...(visualSelections.length ? { visualSelections } : {}),
  };
}

function normalizeDesignIntent(value: unknown): DesignIntentIR | undefined {
  if (!isRecord(value) || value.version !== 1) return undefined;
  return value as unknown as DesignIntentIR;
}

function normalizeSession(value: unknown): ProjectSessionState | null {
  if (!isRecord(value) || value.version !== 1) return null;

  const now = new Date().toISOString();
  const edits = Array.isArray(value.edits)
    ? value.edits
        .map(normalizeEdit)
        .filter((edit): edit is ProjectEditHistoryItem => Boolean(edit))
        .slice(-MAX_EDIT_HISTORY)
    : [];

  const productRequest = normalizeText(value.productRequest, 12_000);
  const initialSummary = normalizeText(value.initialSummary, MAX_SUMMARY_LENGTH);
  const designIntent = normalizeDesignIntent(value.designIntent);

  return {
    version: 1,
    ...(productRequest ? { productRequest } : {}),
    ...(designIntent ? { designIntent } : {}),
    ...(initialSummary ? { initialSummary } : {}),
    createdAt: normalizeText(value.createdAt, 40) ?? now,
    updatedAt: normalizeText(value.updatedAt, 40) ?? now,
    edits,
  };
}

function legacySessionPath(projectDirectory: string): string {
  return path.join(projectDirectory, SESSION_DIRECTORY, SESSION_FILENAME);
}

async function readLegacyProjectSession(
  projectDirectory: string,
): Promise<ProjectSessionState | null> {
  const raw = await readFile(legacySessionPath(projectDirectory), 'utf8').catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return '';
      throw error;
    },
  );

  if (!raw) return null;
  try {
    return normalizeSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

function parseJsonArray(value: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readSelectionsForEdit(editId: string): ProjectVisualSelection[] {
  const database = getYakableDatabase();
  const rows = database.prepare(`
    SELECT source_id, file, line, column, tag_name, text, selector
    FROM project_edit_selections
    WHERE edit_id = ?
    ORDER BY ordinal ASC, id ASC
  `).all(editId) as unknown as SelectionRow[];

  return rows.map((row) => ({
    ...(row.source_id ? { sourceId: row.source_id } : {}),
    ...(row.file ? { file: row.file } : {}),
    ...(row.line && row.line > 0 ? { line: row.line } : {}),
    ...(row.column && row.column > 0 ? { column: row.column } : {}),
    tagName: row.tag_name,
    text: row.text,
    selector: row.selector,
  }));
}

function sessionFromDatabase(projectId: string): ProjectSessionState | null {
  const database = getYakableDatabase();
  const row = database.prepare(`
    SELECT project_id, product_request, design_intent_json, initial_summary, created_at, updated_at
    FROM project_sessions
    WHERE project_id = ?
  `).get(projectId) as unknown as SessionRow | undefined;
  if (!row) return null;

  let designIntent: DesignIntentIR | undefined;
  if (row.design_intent_json) {
    try {
      designIntent = normalizeDesignIntent(JSON.parse(row.design_intent_json));
    } catch {
      designIntent = undefined;
    }
  }

  const editRows = database.prepare(`
    SELECT id, created_at, user_request, assistant_summary, changed_files_json, model
    FROM project_edits
    WHERE project_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(projectId) as unknown as EditRow[];

  const edits = editRows.map((edit): ProjectEditHistoryItem => {
    const visualSelections = readSelectionsForEdit(edit.id);
    return {
      id: edit.id,
      createdAt: edit.created_at,
      userRequest: edit.user_request,
      assistantSummary: edit.assistant_summary,
      changedFiles: normalizeChangedFiles(parseJsonArray(edit.changed_files_json)),
      ...(edit.model ? { model: edit.model } : {}),
      ...(visualSelections.length ? { visualSelections } : {}),
    };
  });

  return {
    version: 1,
    ...(row.product_request ? { productRequest: row.product_request } : {}),
    ...(designIntent ? { designIntent } : {}),
    ...(row.initial_summary ? { initialSummary: row.initial_summary } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    edits,
  };
}

function insertEdit(projectId: string, edit: ProjectEditHistoryItem): void {
  const database = getYakableDatabase();
  database.prepare(`
    INSERT INTO project_edits (
      id, project_id, created_at, user_request, assistant_summary, changed_files_json, model
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    edit.id,
    projectId,
    edit.createdAt,
    edit.userRequest,
    edit.assistantSummary,
    JSON.stringify(normalizeChangedFiles(edit.changedFiles)),
    edit.model ?? null,
  );

  const selections = normalizeVisualSelections(edit.visualSelections);
  const statement = database.prepare(`
    INSERT INTO project_edit_selections (
      edit_id, ordinal, source_id, file, line, column, tag_name, text, selector
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const [index, selection] of selections.entries()) {
    statement.run(
      edit.id,
      index,
      selection.sourceId ?? null,
      selection.file ?? null,
      selection.line ?? null,
      selection.column ?? null,
      selection.tagName,
      selection.text,
      selection.selector,
    );
  }
}

export async function writeProjectSession(
  projectDirectory: string,
  session: ProjectSessionState,
): Promise<void> {
  const normalized = normalizeSession(session);
  if (!normalized) throw new Error('Project session is invalid.');

  const projectId = projectIdForDirectory(projectDirectory);
  const database = getYakableDatabase();
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO project_sessions (
        project_id, product_request, design_intent_json, initial_summary, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        product_request = excluded.product_request,
        design_intent_json = excluded.design_intent_json,
        initial_summary = excluded.initial_summary,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `).run(
      projectId,
      normalized.productRequest ?? null,
      normalized.designIntent ? JSON.stringify(normalized.designIntent) : null,
      normalized.initialSummary ?? null,
      normalized.createdAt,
      normalized.updatedAt,
    );

    database.prepare('DELETE FROM project_edits WHERE project_id = ?').run(projectId);
    for (const edit of normalized.edits) insertEdit(projectId, edit);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export async function initializeProjectSession(
  projectDirectory: string,
  input: {
    productRequest: string;
    designIntent: DesignIntentIR;
    initialSummary: string;
    createdAt?: string;
  },
): Promise<ProjectSessionState> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const session: ProjectSessionState = {
    version: 1,
    productRequest: input.productRequest.trim().slice(0, 12_000),
    designIntent: input.designIntent,
    initialSummary: input.initialSummary.trim().slice(0, MAX_SUMMARY_LENGTH),
    createdAt,
    updatedAt: createdAt,
    edits: [],
  };
  await writeProjectSession(projectDirectory, session);
  return session;
}

export async function readProjectSession(
  projectDirectory: string,
): Promise<ProjectSessionState | null> {
  const projectId = projectIdForDirectory(projectDirectory);
  const existing = sessionFromDatabase(projectId);
  if (existing) return existing;

  const legacy = await readLegacyProjectSession(projectDirectory);
  if (!legacy) return null;

  await writeProjectSession(projectDirectory, legacy);
  return sessionFromDatabase(projectId);
}

export async function appendProjectEditHistory(
  projectDirectory: string,
  input: {
    userRequest: string;
    assistantSummary: string;
    changedFiles: string[];
    model?: string;
    visualSelections?: ProjectVisualSelection[];
    createdAt?: string;
  },
): Promise<ProjectSessionState> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const projectId = projectIdForDirectory(projectDirectory);
  const current = await readProjectSession(projectDirectory);
  const database = getYakableDatabase();

  const userRequest = input.userRequest.trim().slice(0, MAX_REQUEST_LENGTH);
  const assistantSummary = input.assistantSummary.trim().slice(0, MAX_SUMMARY_LENGTH);
  if (!userRequest || !assistantSummary) {
    throw new Error('Project edit history requires a request and summary.');
  }

  const edit: ProjectEditHistoryItem = {
    id: randomUUID(),
    createdAt,
    userRequest,
    assistantSummary,
    changedFiles: normalizeChangedFiles(input.changedFiles),
    ...(normalizeText(input.model, 200) ? { model: normalizeText(input.model, 200) } : {}),
    ...(normalizeVisualSelections(input.visualSelections).length
      ? { visualSelections: normalizeVisualSelections(input.visualSelections) }
      : {}),
  };

  database.exec('BEGIN IMMEDIATE');
  try {
    if (!current) {
      database.prepare(`
        INSERT OR IGNORE INTO project_sessions (
          project_id, product_request, design_intent_json, initial_summary, created_at, updated_at
        ) VALUES (?, NULL, NULL, NULL, ?, ?)
      `).run(projectId, createdAt, createdAt);
    }

    insertEdit(projectId, edit);
    database.prepare('UPDATE project_sessions SET updated_at = ? WHERE project_id = ?')
      .run(createdAt, projectId);
    database.prepare(`
      DELETE FROM project_edits
      WHERE project_id = ?
        AND id NOT IN (
          SELECT id FROM project_edits
          WHERE project_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT ?
        )
    `).run(projectId, projectId, MAX_EDIT_HISTORY);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  const next = sessionFromDatabase(projectId);
  if (!next) throw new Error('Project session could not be reloaded after edit persistence.');
  return next;
}

export async function readProjectConversation(
  projectDirectory: string,
): Promise<ProjectConversation | null> {
  const projectId = projectIdForDirectory(projectDirectory);
  const session = await readProjectSession(projectDirectory);
  if (!session) return null;

  const messages: ProjectConversationMessage[] = [];
  if (session.productRequest) {
    messages.push({
      id: `${projectId}:initial:user`,
      role: 'user',
      content: session.productRequest,
      createdAt: session.createdAt,
    });
  }
  if (session.initialSummary) {
    messages.push({
      id: `${projectId}:initial:assistant`,
      role: 'assistant',
      content: session.initialSummary,
      createdAt: session.createdAt,
    });
  }

  for (const edit of session.edits) {
    messages.push({
      id: `${edit.id}:user`,
      role: 'user',
      content: edit.userRequest,
      createdAt: edit.createdAt,
      ...(edit.visualSelections?.length ? { visualSelections: edit.visualSelections } : {}),
    });
    messages.push({
      id: `${edit.id}:assistant`,
      role: 'assistant',
      content: edit.assistantSummary,
      createdAt: edit.createdAt,
      ...(edit.model ? { model: edit.model } : {}),
      ...(edit.changedFiles.length ? { changedFiles: edit.changedFiles } : {}),
    });
  }

  return {
    projectId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages,
  };
}

export async function cloneProjectSession(
  sourceDirectory: string,
  destinationDirectory: string,
  updatedAt = new Date().toISOString(),
): Promise<ProjectSessionState | null> {
  const source = await readProjectSession(sourceDirectory);
  if (!source) return null;

  const cloned: ProjectSessionState = {
    ...source,
    updatedAt,
    edits: source.edits.map((edit) => ({
      ...edit,
      id: randomUUID(),
      visualSelections: edit.visualSelections?.map((selection) => ({ ...selection })),
    })),
  };
  await writeProjectSession(destinationDirectory, cloned);
  return cloned;
}

export async function deleteProjectSession(projectDirectory: string): Promise<void> {
  const projectId = projectIdForDirectory(projectDirectory);
  getYakableDatabase().prepare('DELETE FROM project_sessions WHERE project_id = ?').run(projectId);
}
