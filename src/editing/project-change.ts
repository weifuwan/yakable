import { stat } from 'node:fs/promises';
import path from 'node:path';

import type { ResolvedGeneratedProject } from '../runtime/runtime.js';
import type { GeneratedFile, ProjectPatch } from '../types.js';
import {
  WorkspaceChangeManager,
  workspaceMutationsFromFiles,
  type WorkspaceChangeSet,
} from '../workspace/index.js';

const MAX_CHANGE_FILES = 12;
const MAX_CHANGE_FILE_BYTES = 200_000;
const MAX_CHANGE_TOTAL_BYTES = 500_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateEditablePath(candidate: string): string {
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

export function createProjectChangeManager(
  project: Pick<ResolvedGeneratedProject, 'directory'>,
): WorkspaceChangeManager {
  return new WorkspaceChangeManager(project.directory);
}

export function applyProjectChanges(
  manager: WorkspaceChangeManager,
  patch: ProjectPatch,
): Promise<WorkspaceChangeSet> {
  return manager.apply(patch.summary, workspaceMutationsFromFiles(patch.changes));
}
