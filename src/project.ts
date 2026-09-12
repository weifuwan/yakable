import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createProjectMetadata,
  normalizeProjectRoutes,
  writeProjectMetadata,
} from './project-metadata.js';
import type { GeneratedFile, GeneratedProject, ProjectTemplate } from './types.js';

const MAX_FILES = 60;
const MAX_FILE_BYTES = 200_000;
const MAX_TOTAL_BYTES = 2_000_000;
const REQUIRED_FILES = [
  'package.json',
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/routes.ts',
] as const;
const BLOCKED_ROOTS = new Set(['.git', '.yakable', 'generated', 'node_modules']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProjectTemplate(value: unknown): value is ProjectTemplate {
  return value === 'website' || value === 'app';
}

function validateFilePath(candidate: string): string {
  if (
    !candidate ||
    candidate.length > 240 ||
    candidate.includes(String.fromCharCode(0)) ||
    candidate.includes('\\') ||
    /[\r\n]/.test(candidate)
  ) {
    throw new Error(`Invalid generated file path: ${candidate || '<empty>'}`);
  }

  if (candidate.startsWith('/') || path.posix.isAbsolute(candidate)) {
    throw new Error(`Generated file path must be relative: ${candidate}`);
  }

  const normalized = path.posix.normalize(candidate);
  const segments = candidate.split('/');

  if (normalized !== candidate || segments.some((segment) => segment === '..' || segment === '.')) {
    throw new Error(`Generated file path is not safe: ${candidate}`);
  }

  if (BLOCKED_ROOTS.has(segments[0] ?? '')) {
    throw new Error(`Generated file path uses a blocked root: ${candidate}`);
  }

  return candidate;
}

function parseFile(value: unknown, index: number): GeneratedFile {
  if (!isRecord(value)) {
    throw new Error(`files[${index}] must be an object.`);
  }

  if (typeof value.path !== 'string' || typeof value.content !== 'string') {
    throw new Error(`files[${index}] must contain string path and content fields.`);
  }

  const safePath = validateFilePath(value.path);
  const bytes = Buffer.byteLength(value.content, 'utf8');

  if (bytes > MAX_FILE_BYTES) {
    throw new Error(`Generated file is too large (${bytes} bytes): ${safePath}`);
  }

  return { path: safePath, content: value.content };
}

export function parseGeneratedProject(rawContent: string): GeneratedProject {
  let value: unknown;

  try {
    value = JSON.parse(rawContent);
  } catch {
    throw new Error('Model output was not valid JSON.');
  }

  if (!isRecord(value) || typeof value.summary !== 'string' || !Array.isArray(value.files)) {
    throw new Error('Model output must contain a string summary and a files array.');
  }

  if (value.files.length === 0 || value.files.length > MAX_FILES) {
    throw new Error(`Generated project must contain between 1 and ${MAX_FILES} files.`);
  }

  const files = value.files.map(parseFile);
  const paths = new Set<string>();
  let totalBytes = 0;

  for (const file of files) {
    if (paths.has(file.path)) {
      throw new Error(`Generated project contains duplicate file path: ${file.path}`);
    }
    paths.add(file.path);
    totalBytes += Buffer.byteLength(file.content, 'utf8');
  }

  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error(`Generated project is too large (${totalBytes} bytes).`);
  }

  for (const requiredPath of REQUIRED_FILES) {
    if (!paths.has(requiredPath)) {
      throw new Error(`Generated project is missing required file: ${requiredPath}`);
    }
  }

  return {
    summary: value.summary.trim() || 'Generated Yakable project',
    template: isProjectTemplate(value.template) ? value.template : 'website',
    routes: normalizeProjectRoutes(value.routes),
    files,
  };
}

export function slugifyPrompt(prompt: string): string {
  const slug = prompt
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return slug || 'app';
}

export async function writeGeneratedProject(
  prompt: string,
  project: GeneratedProject,
  outputRoot = path.resolve(process.cwd(), 'generated'),
): Promise<string> {
  const createdAt = new Date().toISOString();
  const timestamp = createdAt.replace(/[:.]/g, '-');
  const projectId = `${slugifyPrompt(prompt)}-${timestamp}-${randomUUID().slice(0, 8)}`;
  const outputDirectory = path.join(outputRoot, projectId);

  await mkdir(outputRoot, { recursive: true });
  await mkdir(outputDirectory);

  for (const file of project.files) {
    const destination = path.join(outputDirectory, ...file.path.split('/'));
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.content, 'utf8');
  }

  await writeProjectMetadata(
    outputDirectory,
    createProjectMetadata(project.template, project.routes, {
      starred: false,
      createdAt,
      updatedAt: createdAt,
    }),
  );

  return outputDirectory;
}
