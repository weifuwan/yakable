import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import type { Tool, ToolContext, ToolResult } from './tool.js';

export const READ_PROJECT_FILE_MAX_BYTES = 200_000;

const BLOCKED_DIRECTORIES = new Set(['node_modules', 'dist', '.git', '.yakable']);

export interface ReadProjectFileInput {
  path: string;
}

export interface ReadProjectFileOutput {
  path: string;
  content: string;
  bytes: number;
}

function failure(code: string, message: string): ToolResult<ReadProjectFileOutput> {
  return { ok: false, error: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInsideDirectory(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative.length > 0 &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function validateProjectPath(input: unknown): ToolResult<ReadProjectFileOutput> | string {
  if (!isRecord(input) || typeof input.path !== 'string') {
    return failure('INVALID_INPUT', 'read_project_file requires a string path.');
  }

  const requested = input.path.trim();
  if (!requested) {
    return failure('INVALID_PATH', 'Project file path cannot be empty.');
  }
  if (
    requested.includes(String.fromCharCode(0)) ||
    requested.includes('\\') ||
    /[\r\n]/.test(requested) ||
    requested.startsWith('/') ||
    path.posix.isAbsolute(requested)
  ) {
    return failure('INVALID_PATH', `Project file path must be a safe relative POSIX path: ${requested}`);
  }

  const normalized = path.posix.normalize(requested);
  const segments = requested.split('/');
  if (
    normalized !== requested ||
    segments.some((segment) => segment === '..' || segment === '.' || segment.length === 0)
  ) {
    return failure('INVALID_PATH', `Project file path is not safe: ${requested}`);
  }

  if (BLOCKED_DIRECTORIES.has(segments[0] ?? '')) {
    return failure('BLOCKED_PATH', `Project file is outside the readable source surface: ${requested}`);
  }

  const baseName = path.posix.basename(requested);
  if (baseName === '.env' || baseName.startsWith('.env.')) {
    return failure('SENSITIVE_PATH', `Sensitive project file cannot be read: ${requested}`);
  }

  return requested;
}

export const readProjectFileTool: Tool<unknown, ReadProjectFileOutput> = {
  name: 'read_project_file',
  description: 'Read one UTF-8 text file from the current generated frontend project.',

  async execute(
    input: unknown,
    context: ToolContext,
  ): Promise<ToolResult<ReadProjectFileOutput>> {
    const validated = validateProjectPath(input);
    if (typeof validated !== 'string') return validated;

    const projectRoot = await realpath(context.projectDirectory).catch(() => null);
    if (!projectRoot) {
      return failure('PROJECT_NOT_FOUND', `Project directory does not exist: ${context.projectDirectory}`);
    }

    const candidate = path.join(projectRoot, ...validated.split('/'));
    const resolved = await realpath(candidate).catch(() => null);
    if (!resolved) {
      return failure('FILE_NOT_FOUND', `Project file does not exist: ${validated}`);
    }
    if (!isInsideDirectory(projectRoot, resolved)) {
      return failure('OUTSIDE_PROJECT', `Project file resolves outside the project directory: ${validated}`);
    }

    const info = await stat(resolved).catch(() => null);
    if (!info?.isFile()) {
      return failure('NOT_A_FILE', `Project path is not a file: ${validated}`);
    }

    const buffer = await readFile(resolved);
    if (buffer.byteLength > READ_PROJECT_FILE_MAX_BYTES) {
      return failure(
        'FILE_TOO_LARGE',
        `Project file is too large (${buffer.byteLength} bytes; max ${READ_PROJECT_FILE_MAX_BYTES}): ${validated}`,
      );
    }
    if (buffer.includes(0)) {
      return failure('BINARY_FILE', `Binary project file is not readable as text: ${validated}`);
    }

    return {
      ok: true,
      value: {
        path: validated,
        content: buffer.toString('utf8'),
        bytes: buffer.byteLength,
      },
    };
  },
};
