import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  DesignIntentIR,
  ProjectEditHistoryItem,
  ProjectSessionState,
} from '../types.js';

const SESSION_DIRECTORY = '.yakable';
const SESSION_FILENAME = 'session.json';
const MAX_EDIT_HISTORY = 40;
const MAX_REQUEST_LENGTH = 8_000;
const MAX_SUMMARY_LENGTH = 2_000;
const MAX_CHANGED_FILES = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function normalizeEdit(value: unknown): ProjectEditHistoryItem | null {
  if (!isRecord(value)) return null;

  const userRequest = normalizeText(value.userRequest, MAX_REQUEST_LENGTH);
  const assistantSummary = normalizeText(value.assistantSummary, MAX_SUMMARY_LENGTH);
  if (!userRequest || !assistantSummary) return null;

  return {
    id: normalizeText(value.id, 80) ?? randomUUID(),
    createdAt: normalizeText(value.createdAt, 40) ?? new Date().toISOString(),
    userRequest,
    assistantSummary,
    changedFiles: normalizeChangedFiles(value.changedFiles),
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

function sessionPath(projectDirectory: string): string {
  return path.join(projectDirectory, SESSION_DIRECTORY, SESSION_FILENAME);
}

export async function writeProjectSession(
  projectDirectory: string,
  session: ProjectSessionState,
): Promise<void> {
  const normalized = normalizeSession(session);
  if (!normalized) {
    throw new Error('Project session is invalid.');
  }

  const directory = path.join(projectDirectory, SESSION_DIRECTORY);
  await mkdir(directory, { recursive: true });
  await writeFile(sessionPath(projectDirectory), `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
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
  const raw = await readFile(sessionPath(projectDirectory), 'utf8').catch(
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

export async function appendProjectEditHistory(
  projectDirectory: string,
  input: {
    userRequest: string;
    assistantSummary: string;
    changedFiles: string[];
    createdAt?: string;
  },
): Promise<ProjectSessionState> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const current =
    (await readProjectSession(projectDirectory)) ??
    ({
      version: 1,
      createdAt,
      updatedAt: createdAt,
      edits: [],
    } satisfies ProjectSessionState);

  const edit: ProjectEditHistoryItem = {
    id: randomUUID(),
    createdAt,
    userRequest: input.userRequest.trim().slice(0, MAX_REQUEST_LENGTH),
    assistantSummary: input.assistantSummary.trim().slice(0, MAX_SUMMARY_LENGTH),
    changedFiles: normalizeChangedFiles(input.changedFiles),
  };

  if (!edit.userRequest || !edit.assistantSummary) {
    throw new Error('Project edit history requires a request and summary.');
  }

  const next: ProjectSessionState = {
    ...current,
    updatedAt: createdAt,
    edits: [...current.edits, edit].slice(-MAX_EDIT_HISTORY),
  };

  await writeProjectSession(projectDirectory, next);
  return next;
}
