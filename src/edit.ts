import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { requestProjectPatch } from './deepseek.js';
import { resolveGeneratedProject, type ResolvedGeneratedProject } from './runtime.js';
import type { GeneratedFile, ProjectPatch } from './types.js';

const MAX_CONTEXT_FILES = 60;
const MAX_CONTEXT_FILE_BYTES = 200_000;
const MAX_CONTEXT_TOTAL_BYTES = 800_000;
const MAX_FOLLOW_UP_LENGTH = 8_000;
const MAX_CHANGE_FILES = 12;
const MAX_CHANGE_FILE_BYTES = 200_000;
const MAX_CHANGE_TOTAL_BYTES = 500_000;
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.git', '.yakable']);

export interface ProjectSnapshot extends ResolvedGeneratedProject {
  files: GeneratedFile[];
}

export interface EditProjectResult {
  projectId: string;
  projectDirectory: string;
  model: string;
  summary: string;
  changedFiles: string[];
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

function validateEditablePath(candidate: string): string {
  if (
    !candidate ||
    candidate.length > 240 ||
    candidate.includes(String.fromCharCode(0)) ||
    candidate.includes('\\') ||
    /[\r\n]/.test(candidate)
  ) {
    throw new Error(`Invalid Stage 3 change path: ${candidate || '<empty>'}`);
  }

  if (candidate.startsWith('/') || path.posix.isAbsolute(candidate)) {
    throw new Error(`Stage 3 change path must be relative: ${candidate}`);
  }

  const normalized = path.posix.normalize(candidate);
  const segments = candidate.split('/');
  if (normalized !== candidate || segments.some((segment) => segment === '..' || segment === '.')) {
    throw new Error(`Stage 3 change path is not safe: ${candidate}`);
  }

  const writable =
    candidate === 'index.html' ||
    candidate.startsWith('src/') ||
    candidate.startsWith('public/');

  if (!writable) {
    throw new Error(
      `Stage 3 can only modify src/**, public/**, or index.html: ${candidate}`,
    );
  }

  return candidate;
}

async function collectProjectFiles(
  projectDirectory: string,
  currentDirectory = projectDirectory,
): Promise<GeneratedFile[]> {
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  const files: GeneratedFile[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDirectory, entry.name);
    const relativePath = toPosixPath(path.relative(projectDirectory, absolutePath));

    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        files.push(...(await collectProjectFiles(projectDirectory, absolutePath)));
      }
      continue;
    }

    if (!entry.isFile() || isSensitiveProjectFile(relativePath)) {
      continue;
    }

    const buffer = await readFile(absolutePath);
    if (buffer.includes(0)) {
      continue;
    }

    if (buffer.byteLength > MAX_CONTEXT_FILE_BYTES) {
      throw new Error(`Project file is too large for Stage 3 context: ${relativePath}`);
    }

    files.push({ path: relativePath, content: buffer.toString('utf8') });
  }

  return files;
}

export async function readProjectSnapshot(
  project: ResolvedGeneratedProject,
): Promise<ProjectSnapshot> {
  const files = await collectProjectFiles(project.directory);

  if (files.length === 0 || files.length > MAX_CONTEXT_FILES) {
    throw new Error(
      `Stage 3 project context must contain between 1 and ${MAX_CONTEXT_FILES} text files.`,
    );
  }

  const totalBytes = files.reduce(
    (sum, file) => sum + Buffer.byteLength(file.content, 'utf8'),
    0,
  );
  if (totalBytes > MAX_CONTEXT_TOTAL_BYTES) {
    throw new Error(
      `Stage 3 project context is too large (${totalBytes} bytes; max ${MAX_CONTEXT_TOTAL_BYTES}).`,
    );
  }

  return { ...project, files };
}

export function parseProjectPatch(rawContent: string): ProjectPatch {
  let value: unknown;

  try {
    value = JSON.parse(rawContent);
  } catch {
    throw new Error('Stage 3 model output was not valid JSON.');
  }

  if (!isRecord(value) || typeof value.summary !== 'string' || !Array.isArray(value.changes)) {
    throw new Error('Stage 3 model output must contain a string summary and a changes array.');
  }

  if (value.changes.length === 0 || value.changes.length > MAX_CHANGE_FILES) {
    throw new Error(`Stage 3 must return between 1 and ${MAX_CHANGE_FILES} changed files.`);
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
      throw new Error(`Stage 3 returned duplicate change path: ${safePath}`);
    }
    paths.add(safePath);

    const bytes = Buffer.byteLength(change.content, 'utf8');
    if (bytes > MAX_CHANGE_FILE_BYTES) {
      throw new Error(`Stage 3 changed file is too large (${bytes} bytes): ${safePath}`);
    }

    totalBytes += bytes;
    changes.push({ path: safePath, content: change.content });
  }

  if (totalBytes > MAX_CHANGE_TOTAL_BYTES) {
    throw new Error(`Stage 3 changes are too large (${totalBytes} bytes).`);
  }

  return {
    summary: value.summary.trim() || 'Updated generated project',
    changes,
  };
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

    if (existing === change.content) {
      continue;
    }

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, change.content, 'utf8');
    changedFiles.push(safePath);
  }

  if (changedFiles.length === 0) {
    throw new Error('Stage 3 returned no effective source changes.');
  }

  return changedFiles;
}

export async function editGeneratedProject(
  projectInput: string,
  followUpRequest: string,
): Promise<EditProjectResult> {
  const request = followUpRequest.trim();
  if (!request) {
    throw new Error('A follow-up edit request is required.');
  }
  if (request.length > MAX_FOLLOW_UP_LENGTH) {
    throw new Error(`Follow-up edit request is too long (max ${MAX_FOLLOW_UP_LENGTH} characters).`);
  }

  const project = await resolveGeneratedProject(projectInput);
  const snapshot = await readProjectSnapshot(project);
  const editContext = JSON.stringify({
    followUpRequest: request,
    project: {
      id: snapshot.id,
      files: snapshot.files,
    },
  });

  const generation = await requestProjectPatch(editContext);
  const patch = parseProjectPatch(generation.content);
  const changedFiles = await applyProjectPatch(project, patch);

  return {
    projectId: project.id,
    projectDirectory: project.directory,
    model: generation.model,
    summary: patch.summary,
    changedFiles,
  };
}
