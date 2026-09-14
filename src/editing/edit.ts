import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  MAX_EDIT_CONTEXT_FILES,
  MAX_PROJECT_CONTEXT_CANDIDATES,
  selectProjectContextFiles,
  type EditContextSelection,
} from './context-selection.js';
import { resolveProjectContextSearch } from './context-search.js';
import {
  resolveEditIntentDelta,
  type EditIntentDelta,
  type EditIntentResolution,
} from './edit-intent.js';
import { runOneShotRepair, type OneShotRepairResult } from './repair.js';
import { requestProjectPatch, requestProjectRepair } from '../model/deepseek.js';
import {
  appendProjectEditHistory,
  readProjectSession,
} from '../projects/project-session.js';
import { resolveGeneratedProject, type ResolvedGeneratedProject } from '../runtime/runtime.js';
import { checkProjectTool, type CheckProjectOutput } from '../tools/check-project.js';
import { readProjectFileTool } from '../tools/read-project-file.js';
import type { ToolResult } from '../tools/tool.js';
import type {
  GeneratedFile,
  ProjectPatch,
  ProjectSessionState,
  ProjectVisualSelection,
} from '../types.js';

const MAX_CONTEXT_TOTAL_BYTES = 800_000;
const MAX_FOLLOW_UP_LENGTH = 8_000;
const MAX_CHANGE_FILES = 12;
const MAX_CHANGE_FILE_BYTES = 200_000;
const MAX_CHANGE_TOTAL_BYTES = 500_000;
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

export interface EditProjectResult {
  projectId: string;
  projectDirectory: string;
  model: string;
  summary: string;
  changedFiles: string[];
  editIntent: EditIntentResolution;
  contextSelection: EditContextSelection;
  repair: OneShotRepairResult;
  projectCheck: ToolResult<CheckProjectOutput>;
  session: ProjectSessionState | null;
}

export interface UserEditContext {
  userRequest: string;
  visualSelections: ProjectVisualSelection[];
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

function validateEditablePath(candidate: string): string {
  if (
    !candidate ||
    candidate.length > 240 ||
    candidate.includes(String.fromCharCode(0)) ||
    candidate.includes('\\') ||
    /[\r\n]/.test(candidate)
  ) {
    throw new Error(`Invalid project edit path: ${candidate || '<empty>'}`);
  }

  if (candidate.startsWith('/') || path.posix.isAbsolute(candidate)) {
    throw new Error(`Project edit path must be relative: ${candidate}`);
  }

  const normalized = path.posix.normalize(candidate);
  const segments = candidate.split('/');
  if (normalized !== candidate || segments.some((segment) => segment === '..' || segment === '.')) {
    throw new Error(`Project edit path is not safe: ${candidate}`);
  }

  const writable =
    candidate === 'index.html' ||
    candidate.startsWith('src/') ||
    candidate.startsWith('public/');

  if (!writable) {
    throw new Error(
      `Project edits can only modify src/**, public/**, or index.html: ${candidate}`,
    );
  }

  return candidate;
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

export function parseProjectPatch(rawContent: string): ProjectPatch {
  let value: unknown;

  try {
    value = JSON.parse(rawContent);
  } catch {
    throw new Error('Project edit model output was not valid JSON.');
  }

  if (!isRecord(value) || typeof value.summary !== 'string' || !Array.isArray(value.changes)) {
    throw new Error('Project edit model output must contain a string summary and a changes array.');
  }

  if (value.changes.length === 0 || value.changes.length > MAX_CHANGE_FILES) {
    throw new Error(`Project edit must return between 1 and ${MAX_CHANGE_FILES} changed files.`);
  }

  const paths = new Set<string>();
  const changes: GeneratedFile[] = [];
  let totalBytes = 0;

  for (const [index, change] of value.changes.entries()) {
    if (!isRecord(change) || typeof change.path !== 'string' || typeof change.content !== 'string') {
      throw new Error(`changes[${index}] must contain string path and content fields.`);
    }

    const safePath = validateEditablePath(change.path);
    if (paths.has(safePath)) {
      throw new Error(`Project edit returned duplicate change path: ${safePath}`);
    }
    paths.add(safePath);

    const bytes = Buffer.byteLength(change.content, 'utf8');
    if (bytes > MAX_CHANGE_FILE_BYTES) {
      throw new Error(`Project edit changed file is too large (${bytes} bytes): ${safePath}`);
    }

    totalBytes += bytes;
    changes.push({ path: safePath, content: change.content });
  }

  if (totalBytes > MAX_CHANGE_TOTAL_BYTES) {
    throw new Error(`Project edit changes are too large (${totalBytes} bytes).`);
  }

  return {
    summary: value.summary.trim() || 'Updated generated project',
    changes,
  };
}

export async function assertPatchUsesSelectedContext(
  project: ResolvedGeneratedProject,
  patch: ProjectPatch,
  selectedFiles: string[],
): Promise<void> {
  const selected = new Set(selectedFiles);

  for (const change of patch.changes) {
    if (selected.has(change.path)) continue;

    const destination = path.join(project.directory, ...change.path.split('/'));
    const info = await stat(destination).catch(() => null);
    if (info?.isFile()) {
      throw new Error(
        `Project edit attempted to modify an existing file outside selected context: ${change.path}`,
      );
    }
  }
}

export async function applyProjectPatch(
  project: ResolvedGeneratedProject,
  patch: ProjectPatch,
): Promise<string[]> {
  const changedFiles: string[] = [];

  for (const change of patch.changes) {
    const safePath = validateEditablePath(change.path);
    const destination = path.join(project.directory, ...safePath.split('/'));
    const existing = await readFile(destination, 'utf8').catch(() => null);

    if (existing === change.content) continue;

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, change.content, 'utf8');
    changedFiles.push(safePath);
  }

  if (changedFiles.length === 0) {
    throw new Error('Project edit returned no effective source changes.');
  }

  return changedFiles;
}

export async function editGeneratedProject(
  projectInput: string,
  followUpRequest: string,
): Promise<EditProjectResult> {
  const request = followUpRequest.trim();
  if (!request) throw new Error('A follow-up edit request is required.');
  if (request.length > MAX_FOLLOW_UP_LENGTH) {
    throw new Error(`Follow-up edit request is too long (max ${MAX_FOLLOW_UP_LENGTH} characters).`);
  }

  const project = await resolveGeneratedProject(projectInput);
  const userEdit = extractUserEditContext(request);
  const session = await readProjectSession(project.directory);
  const editIntent = await resolveEditIntentDelta({
    userRequest: userEdit.userRequest,
    baselineDesignIntent: session?.designIntent ?? null,
    visualSelections: userEdit.visualSelections,
  });
  const availableFiles = await listProjectContextFiles(project.directory);
  const initialContextSelection = await selectProjectContextFiles(
    {
      ...userEdit,
      editIntent: editIntent.delta,
    },
    availableFiles,
  );
  const contextSelection = await resolveProjectContextSearch(
    project.directory,
    userEdit.userRequest,
    availableFiles,
    initialContextSelection,
  );
  const snapshot = await readProjectSnapshot(project, contextSelection.relevantFiles);
  const editContext = buildProjectEditContext(snapshot, request, session, editIntent.delta);

  const generation = await requestProjectPatch(editContext);
  const patch = parseProjectPatch(generation.content);
  await assertPatchUsesSelectedContext(project, patch, contextSelection.relevantFiles);
  const initialChangedFiles = await applyProjectPatch(project, patch);
  const initialProjectCheck = await checkProjectTool.execute(
    {},
    { projectDirectory: project.directory },
  );

  const repair = await runOneShotRepair({
    projectId: project.id,
    userRequest: userEdit.userRequest,
    initialEditSummary: patch.summary,
    initialChangedFiles,
    selectedContextFiles: contextSelection.relevantFiles,
    availableFiles,
    initialCheck: initialProjectCheck,
    readFiles: async (paths) => (await readProjectSnapshot(project, paths)).files,
    requestRepair: requestProjectRepair,
    parsePatch: parseProjectPatch,
    applyPatch: (repairPatch) => applyProjectPatch(project, repairPatch),
    checkProject: () =>
      checkProjectTool.execute({}, { projectDirectory: project.directory }),
  });

  const changedFiles = [...new Set([...initialChangedFiles, ...repair.changedFiles])];
  const projectCheck = repair.finalCheck;

  let nextSession = session;
  try {
    nextSession = await appendProjectEditHistory(project.directory, {
      userRequest: userEdit.userRequest,
      assistantSummary: patch.summary,
      changedFiles,
      model: generation.model,
      visualSelections: userEdit.visualSelections,
    });
  } catch (error) {
    console.warn('[Yakable Edit] Source update succeeded but conversation history could not be persisted.', error);
  }

  return {
    projectId: project.id,
    projectDirectory: project.directory,
    model: generation.model,
    summary: patch.summary,
    changedFiles,
    editIntent,
    contextSelection,
    repair,
    projectCheck,
    session: nextSession,
  };
}
