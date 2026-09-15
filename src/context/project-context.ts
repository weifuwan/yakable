import { readdir } from 'node:fs/promises';
import path from 'node:path';

import type { EditIntentDelta } from '../editing/edit-intent.js';
import type { ResolvedGeneratedProject } from '../runtime/runtime.js';
import { readProjectFileTool } from '../tools/read-project-file.js';
import type {
  GeneratedFile,
  ProjectSessionState,
  ProjectVisualSelection,
} from '../types.js';
import { resolveProjectContextSearch } from './project-context-search.js';
import {
  MAX_EDIT_CONTEXT_FILES,
  MAX_PROJECT_CONTEXT_CANDIDATES,
  selectProjectContextFiles,
  type EditContextSelection,
} from './project-context-selection.js';

const MAX_CONTEXT_TOTAL_BYTES = 800_000;
const MAX_HISTORY_CONTEXT = 12;
const MAX_VISUAL_SELECTIONS = 20;
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.git', '.yakable']);
const EXCLUDED_CONTEXT_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
]);
const CONTEXT_TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.html',
  '.json',
  '.md',
  '.txt',
  '.svg',
]);
const VISUAL_EDIT_START = '[[YAKABLE_VISUAL_EDIT_REQUEST]]';
const VISUAL_EDIT_END = '[[/YAKABLE_VISUAL_EDIT_REQUEST]]';

export interface ProjectSnapshot extends ResolvedGeneratedProject {
  files: GeneratedFile[];
}

export interface UserEditContext {
  userRequest: string;
  visualSelections: ProjectVisualSelection[];
}

export interface ResolveProjectEditContextInput {
  projectDirectory: string;
  userRequest: string;
  visualSelections: ProjectVisualSelection[];
  editIntent?: EditIntentDelta;
  assertActive?: () => void;
}

export interface ResolvedProjectEditContext {
  availableFiles: string[];
  contextSelection: EditContextSelection;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

function isSensitiveProjectFile(relativePath: string): boolean {
  const base = path.posix.basename(relativePath);
  return base === '.env' || base.startsWith('.env.');
}

function isContextTextFile(relativePath: string): boolean {
  const base = path.posix.basename(relativePath);
  if (EXCLUDED_CONTEXT_FILES.has(base)) return false;
  return CONTEXT_TEXT_EXTENSIONS.has(path.posix.extname(relativePath).toLowerCase());
}

async function collectProjectContextPaths(
  projectDirectory: string,
  currentDirectory = projectDirectory,
): Promise<string[]> {
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(currentDirectory, entry.name);
    const relativePath = toPosixPath(path.relative(projectDirectory, absolutePath));

    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        files.push(...(await collectProjectContextPaths(projectDirectory, absolutePath)));
      }
      continue;
    }

    if (
      !entry.isFile() ||
      isSensitiveProjectFile(relativePath) ||
      !isContextTextFile(relativePath)
    ) {
      continue;
    }
    files.push(relativePath);
  }
  return files;
}

export async function listProjectContextFiles(projectDirectory: string): Promise<string[]> {
  const files = await collectProjectContextPaths(projectDirectory);
  if (files.length === 0) {
    throw new Error('Project has no readable text files for edit context.');
  }
  if (files.length > MAX_PROJECT_CONTEXT_CANDIDATES) {
    throw new Error(
      `Project has too many context candidates (${files.length}; max ${MAX_PROJECT_CONTEXT_CANDIDATES}).`,
    );
  }
  return files;
}

export async function resolveProjectEditContext(
  input: ResolveProjectEditContextInput,
): Promise<ResolvedProjectEditContext> {
  input.assertActive?.();
  const availableFiles = await listProjectContextFiles(input.projectDirectory);
  input.assertActive?.();
  const initialSelection = await selectProjectContextFiles(
    {
      userRequest: input.userRequest,
      visualSelections: input.visualSelections,
      ...(input.editIntent ? { editIntent: input.editIntent } : {}),
    },
    availableFiles,
  );
  input.assertActive?.();
  const contextSelection = await resolveProjectContextSearch(
    input.projectDirectory,
    input.userRequest,
    availableFiles,
    initialSelection,
  );
  input.assertActive?.();
  return { availableFiles, contextSelection };
}

export async function readProjectSnapshot(
  project: ResolvedGeneratedProject,
  selectedPaths: string[],
): Promise<ProjectSnapshot> {
  const paths = [...new Set(selectedPaths)];
  if (paths.length === 0 || paths.length > MAX_EDIT_CONTEXT_FILES) {
    throw new Error(
      `Project edit context must contain between 1 and ${MAX_EDIT_CONTEXT_FILES} selected files.`,
    );
  }

  const files: GeneratedFile[] = [];
  for (const relativePath of paths) {
    const result = await readProjectFileTool.execute(
      { path: relativePath },
      { projectDirectory: project.directory },
    );
    if (!result.ok) {
      throw new Error(
        `Could not read selected project context (${relativePath}): ${result.error.message}`,
      );
    }
    files.push({ path: result.value.path, content: result.value.content });
  }

  const totalBytes = files.reduce(
    (sum, file) => sum + Buffer.byteLength(file.content, 'utf8'),
    0,
  );
  if (totalBytes > MAX_CONTEXT_TOTAL_BYTES) {
    throw new Error(
      `Project edit context is too large (${totalBytes} bytes; max ${MAX_CONTEXT_TOTAL_BYTES}).`,
    );
  }

  return { ...project, files };
}

function optionalString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function visualSelectionsFromEnvelope(value: unknown): ProjectVisualSelection[] {
  if (!isRecord(value)) return [];
  const selections: ProjectVisualSelection[] = [];

  const targets = Array.isArray(value.targets) ? value.targets : [];
  for (const target of targets) {
    if (!isRecord(target)) continue;
    const file = optionalString(target.file, 240);
    const line = positiveInteger(target.line);
    const column = positiveInteger(target.column);
    const tagName = optionalString(target.tagName, 80);
    const sourceId = optionalString(target.sourceId, 120);
    if (!tagName) continue;

    const instances = Array.isArray(target.instances) ? target.instances : [];
    if (instances.length === 0) {
      selections.push({
        ...(sourceId ? { sourceId } : {}),
        ...(file ? { file } : {}),
        ...(line ? { line } : {}),
        ...(column ? { column } : {}),
        tagName,
        text: '',
        selector: '',
      });
    }

    for (const instance of instances) {
      if (!isRecord(instance)) continue;
      selections.push({
        ...(sourceId ? { sourceId } : {}),
        ...(file ? { file } : {}),
        ...(line ? { line } : {}),
        ...(column ? { column } : {}),
        tagName,
        text: typeof instance.text === 'string' ? instance.text.trim().slice(0, 180) : '',
        selector:
          typeof instance.selector === 'string' ? instance.selector.trim().slice(0, 320) : '',
      });
      if (selections.length >= MAX_VISUAL_SELECTIONS) return selections;
    }
    if (selections.length >= MAX_VISUAL_SELECTIONS) return selections;
  }

  const unmapped = Array.isArray(value.unmappedSelections) ? value.unmappedSelections : [];
  for (const item of unmapped) {
    if (!isRecord(item)) continue;
    const tagName = optionalString(item.tagName, 80);
    if (!tagName) continue;
    selections.push({
      tagName,
      text: typeof item.text === 'string' ? item.text.trim().slice(0, 180) : '',
      selector: typeof item.selector === 'string' ? item.selector.trim().slice(0, 320) : '',
    });
    if (selections.length >= MAX_VISUAL_SELECTIONS) break;
  }

  return selections;
}

export function extractUserEditContext(request: string): UserEditContext {
  const start = request.indexOf(VISUAL_EDIT_START);
  const end = request.indexOf(VISUAL_EDIT_END);
  if (start === -1 || end === -1 || end <= start) {
    return { userRequest: request.trim(), visualSelections: [] };
  }

  const payload = request.slice(start + VISUAL_EDIT_START.length, end).trim();
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!isRecord(parsed)) throw new Error('Visual edit payload must be an object.');
    const userRequest =
      typeof parsed.userRequest === 'string' && parsed.userRequest.trim()
        ? parsed.userRequest.trim()
        : request.trim();
    return {
      userRequest,
      visualSelections: visualSelectionsFromEnvelope(parsed.visualSelections),
    };
  } catch {
    return { userRequest: request.trim(), visualSelections: [] };
  }
}

export function extractUserEditRequest(request: string): string {
  return extractUserEditContext(request).userRequest;
}

export function buildProjectEditContext(
  snapshot: ProjectSnapshot,
  followUpRequest: string,
  session: ProjectSessionState | null,
  editIntent: EditIntentDelta | null = null,
): string {
  const recentEdits = session?.edits.slice(-MAX_HISTORY_CONTEXT).map((edit) => ({
    userRequest: edit.userRequest,
    assistantSummary: edit.assistantSummary,
    changedFiles: edit.changedFiles,
  })) ?? [];

  return JSON.stringify({
    followUpRequest,
    editIntent,
    continuity: session
      ? {
          originalProductRequest: session.productRequest ?? null,
          designIntent: session.designIntent ?? null,
          recentEdits,
        }
      : null,
    project: {
      id: snapshot.id,
      files: snapshot.files,
    },
  });
}
