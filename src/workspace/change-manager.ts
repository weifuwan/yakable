import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  WorkspaceChangeSet,
  WorkspaceFileChange,
  WorkspaceMutation,
} from './change-set.js';

const MAX_WORKSPACE_PATH_LENGTH = 240;
const DEFAULT_MAX_FILE_BYTES = 250_000;
const DEFAULT_MAX_TOTAL_BYTES = 2_000_000;
const BLOCKED_ROOTS = new Set(['.git', '.yakable', 'generated', 'node_modules']);

export interface WorkspaceChangeManagerOptions {
  maxFileBytes?: number;
  maxTotalBytes?: number;
  idFactory?: () => string;
  now?: () => Date;
}

export class WorkspaceChangeApplyError extends Error {
  readonly rolledBack: boolean;

  constructor(message: string, rolledBack: boolean, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'WorkspaceChangeApplyError';
    this.rolledBack = rolledBack;
  }
}

export class WorkspaceChangeConflictError extends Error {
  readonly path: string;

  constructor(relativePath: string) {
    super(`Workspace rollback conflict: ${relativePath} no longer matches the applied change.`);
    this.name = 'WorkspaceChangeConflictError';
    this.path = relativePath;
  }
}

function isSensitiveFile(relativePath: string): boolean {
  const base = path.posix.basename(relativePath);
  return base === '.env' || base.startsWith('.env.');
}

export function validateWorkspacePath(candidate: string): string {
  if (
    !candidate ||
    candidate.length > MAX_WORKSPACE_PATH_LENGTH ||
    candidate.includes(String.fromCharCode(0)) ||
    candidate.includes('\\') ||
    /[\r\n]/.test(candidate)
  ) {
    throw new Error(`Invalid workspace path: ${candidate || '<empty>'}`);
  }

  if (candidate.startsWith('/') || path.posix.isAbsolute(candidate)) {
    throw new Error(`Workspace path must be relative: ${candidate}`);
  }

  const normalized = path.posix.normalize(candidate);
  const segments = candidate.split('/');
  if (normalized !== candidate || segments.some((segment) => segment === '..' || segment === '.')) {
    throw new Error(`Workspace path is not safe: ${candidate}`);
  }

  if (BLOCKED_ROOTS.has(segments[0] ?? '')) {
    throw new Error(`Workspace path uses a blocked root: ${candidate}`);
  }

  if (isSensitiveFile(candidate)) {
    throw new Error(`Workspace mutation cannot target environment files: ${candidate}`);
  }

  return candidate;
}

function classifyChange(
  beforeContent: string | null,
  afterContent: string | null,
): WorkspaceFileChange['type'] | null {
  if (beforeContent === afterContent) return null;
  if (beforeContent === null) return 'ADDED';
  if (afterContent === null) return 'DELETED';
  return 'MODIFIED';
}

export class WorkspaceChangeManager {
  readonly root: string;

  private readonly maxFileBytes: number;
  private readonly maxTotalBytes: number;
  private readonly idFactory: () => string;
  private readonly now: () => Date;

  constructor(root: string, options: WorkspaceChangeManagerOptions = {}) {
    this.root = path.resolve(root);
    this.maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
    this.maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
    this.idFactory = options.idFactory ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async read(relativePath: string): Promise<string | null> {
    const safePath = validateWorkspacePath(relativePath);
    const target = path.join(this.root, ...safePath.split('/'));
    try {
      return await readFile(target, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async plan(
    summary: string,
    mutations: readonly WorkspaceMutation[],
  ): Promise<WorkspaceChangeSet> {
    const normalizedSummary = summary.trim();
    if (!normalizedSummary) throw new Error('Workspace change summary is required.');
    if (!Array.isArray(mutations) || mutations.length === 0) {
      throw new Error('Workspace change requires at least one mutation.');
    }

    const seen = new Set<string>();
    const files: WorkspaceFileChange[] = [];
    let totalBytes = 0;

    for (const mutation of mutations) {
      const safePath = validateWorkspacePath(mutation.path);
      if (seen.has(safePath)) {
        throw new Error(`Workspace change contains duplicate path: ${safePath}`);
      }
      seen.add(safePath);

      if (mutation.content !== null) {
        const bytes = Buffer.byteLength(mutation.content, 'utf8');
        if (bytes > this.maxFileBytes) {
          throw new Error(
            `Workspace file is too large (${bytes} bytes; max ${this.maxFileBytes}): ${safePath}`,
          );
        }
        totalBytes += bytes;
      }

      const beforeContent = await this.read(safePath);
      const type = classifyChange(beforeContent, mutation.content);
      if (!type) continue;

      files.push({
        path: safePath,
        type,
        beforeContent,
        afterContent: mutation.content,
      });
    }

    if (totalBytes > this.maxTotalBytes) {
      throw new Error(
        `Workspace change is too large (${totalBytes} bytes; max ${this.maxTotalBytes}).`,
      );
    }
    if (files.length === 0) {
      throw new Error('Workspace change contains no effective file mutations.');
    }

    return {
      id: this.idFactory(),
      summary: normalizedSummary,
      createdAt: this.now().toISOString(),
      files,
    };
  }

  async apply(
    summary: string,
    mutations: readonly WorkspaceMutation[],
  ): Promise<WorkspaceChangeSet> {
    const changeSet = await this.plan(summary, mutations);
    const applied: WorkspaceFileChange[] = [];

    try {
      for (const file of changeSet.files) {
        await this.writeState(file.path, file.afterContent);
        applied.push(file);
      }
      return changeSet;
    } catch (error) {
      let rollbackError: unknown;
      try {
        for (const file of [...applied].reverse()) {
          await this.writeState(file.path, file.beforeContent);
        }
      } catch (restoreError) {
        rollbackError = restoreError;
      }

      if (rollbackError) {
        throw new WorkspaceChangeApplyError(
          `Workspace change failed and automatic rollback also failed: ${
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          }`,
          false,
          error,
        );
      }

      throw new WorkspaceChangeApplyError(
        `Workspace change failed and was rolled back: ${
          error instanceof Error ? error.message : String(error)
        }`,
        true,
        error,
      );
    }
  }

  async rollback(changeSet: WorkspaceChangeSet): Promise<void> {
    for (const file of changeSet.files) {
      const current = await this.read(file.path);
      if (current !== file.afterContent) {
        throw new WorkspaceChangeConflictError(file.path);
      }
    }

    for (const file of [...changeSet.files].reverse()) {
      await this.writeState(file.path, file.beforeContent);
    }
  }

  private async writeState(relativePath: string, content: string | null): Promise<void> {
    const safePath = validateWorkspacePath(relativePath);
    const target = path.join(this.root, ...safePath.split('/'));

    if (content === null) {
      await rm(target, { force: true });
      return;
    }

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
}
