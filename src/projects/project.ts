import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createBaseProject,
  isBaseTemplateProjectOwnedPath,
} from '../templates/base-template.js';
import type { GeneratedFile, GeneratedProject, ProjectTemplate } from '../types.js';
import {
  createProjectMetadata,
  normalizeProjectRoutes,
  writeProjectMetadata,
} from './project-metadata.js';

const MAX_FILES = 60;
const MAX_FILE_BYTES = 200_000;
const MAX_TOTAL_BYTES = 2_000_000;
const STANDALONE_REQUIRED_FILES = [
  'package.json',
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/routes.ts',
] as const;
const BASE_OVERLAY_REQUIRED_FILES = ['src/App.tsx', 'src/routes.ts'] as const;
const BLOCKED_ROOTS = new Set(['.git', '.yakable', 'generated', 'node_modules']);

export type GeneratedProjectParseMode = 'standalone' | 'base-overlay';

export interface ParseGeneratedProjectOptions {
  mode?: GeneratedProjectParseMode;
  expectedTemplate?: ProjectTemplate;
}

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

function assertBaseOverlayFiles(files: GeneratedFile[], template: ProjectTemplate): void {
  for (const file of files) {
    if (!isBaseTemplateProjectOwnedPath(file.path)) {
      throw new Error(
        `Yakable Base generation may only write project-owned files: ${file.path}`,
      );
    }

    if (file.path.endsWith('.css') && file.path !== 'src/styles/theme.css') {
      throw new Error(
        `Generated product styling must use Tailwind utilities; only src/styles/theme.css may contain project-owned CSS: ${file.path}`,
      );
    }

    if (
      file.path.startsWith('src/components/product/') &&
      /(?:^|\/)\w*Page\.tsx$/i.test(file.path)
    ) {
      throw new Error(`Route-level page files must live under src/pages/: ${file.path}`);
    }
  }

  if (template === 'app' && !files.some((file) => file.path.startsWith('src/pages/'))) {
    throw new Error('Yakable app generation must create route-level files under src/pages/.');
  }
}

export function parseGeneratedProject(
  rawContent: string,
  options: ParseGeneratedProjectOptions = {},
): GeneratedProject {
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

  const mode = options.mode ?? 'standalone';
  const parsedTemplate = isProjectTemplate(value.template)
    ? value.template
    : options.expectedTemplate ?? 'website';

  if (options.expectedTemplate && parsedTemplate !== options.expectedTemplate) {
    throw new Error(
      `Model output template ${parsedTemplate} does not match selected template ${options.expectedTemplate}.`,
    );
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

  const requiredFiles =
    mode === 'base-overlay' ? BASE_OVERLAY_REQUIRED_FILES : STANDALONE_REQUIRED_FILES;
  for (const requiredPath of requiredFiles) {
    if (!paths.has(requiredPath)) {
      throw new Error(`Generated project is missing required file: ${requiredPath}`);
    }
  }

  if (mode === 'base-overlay') {
    assertBaseOverlayFiles(files, parsedTemplate);
  }

  return {
    summary: value.summary.trim() || 'Generated Yakable project',
    template: parsedTemplate,
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

function createGeneratedProjectId(prompt: string, createdAt: string): string {
  const timestamp = createdAt.replace(/[:.]/g, '-');
  return `${slugifyPrompt(prompt)}-${timestamp}-${randomUUID().slice(0, 8)}`;
}

async function writeProjectFiles(
  outputDirectory: string,
  files: GeneratedFile[],
): Promise<void> {
  for (const file of files) {
    const destination = path.join(outputDirectory, ...file.path.split('/'));
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.content, 'utf8');
  }
}

export async function writeGeneratedProject(
  prompt: string,
  project: GeneratedProject,
  outputRoot = path.resolve(process.cwd(), 'generated'),
): Promise<string> {
  const createdAt = new Date().toISOString();
  const projectId = createGeneratedProjectId(prompt, createdAt);
  const outputDirectory = path.join(outputRoot, projectId);

  await mkdir(outputRoot, { recursive: true });
  await mkdir(outputDirectory);
  await writeProjectFiles(outputDirectory, project.files);

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

export async function writeGeneratedProjectFromBase(
  prompt: string,
  project: GeneratedProject,
  outputRoot = path.resolve(process.cwd(), 'generated'),
  templateRoot = path.resolve(process.cwd(), 'templates', 'base'),
): Promise<string> {
  assertBaseOverlayFiles(project.files, project.template);

  const createdAt = new Date().toISOString();
  const projectId = createGeneratedProjectId(prompt, createdAt);
  const created = await createBaseProject(projectId, {
    outputRoot,
    templateRoot,
  });

  try {
    await writeProjectFiles(created.directory, project.files);
    await writeProjectMetadata(
      created.directory,
      createProjectMetadata(project.template, project.routes, {
        starred: false,
        createdAt,
        updatedAt: createdAt,
      }),
    );
    return created.directory;
  } catch (error) {
    await rm(created.directory, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}
