import { cp, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { createProjectMetadata, writeProjectMetadata } from '../projects/project-metadata.js';

export const BASE_TEMPLATE_ID = 'base' as const;
export const BASE_TEMPLATE_VERSION = 1 as const;

export const BASE_TEMPLATE_YAKABLE_OWNED_PATHS = [
  '.yakable/**',
  'AGENTS.md',
  'README.md',
  'components.json',
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'yakable.template.json',
  'src/main.tsx',
  'src/styles.css',
  'src/lib/utils.ts',
  'src/components/ui/**',
] as const;

export const BASE_TEMPLATE_PROJECT_OWNED_PATHS = [
  'index.html',
  'public/**',
  'src/styles/theme.css',
  'src/App.tsx',
  'src/routes.ts',
  'src/pages/**',
  'src/components/product/**',
  'src/features/**',
  'src/data/**',
] as const;

const PROJECT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;
const REQUIRED_BASE_FILES = [
  'package.json',
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  'components.json',
  'yakable.template.json',
  'src/main.tsx',
  'src/App.tsx',
  'src/routes.ts',
  'src/styles.css',
  'src/styles/theme.css',
  'src/lib/utils.ts',
  'src/components/ui/button.tsx',
  'src/components/ui/input.tsx',
  'src/components/ui/label.tsx',
  'src/components/ui/separator.tsx',
] as const;

export interface BaseTemplateManifest {
  version: 1;
  id: 'base';
  description: string;
  ownership: {
    yakable: string[];
    project: string[];
  };
}

export interface CreateBaseProjectOptions {
  outputRoot?: string;
  templateRoot?: string;
  displayName?: string;
}

export interface CreatedBaseProject {
  id: string;
  directory: string;
  manifest: BaseTemplateManifest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`Yakable Base manifest ${field} must be a non-empty string array.`);
  }
  return [...new Set(value.map((item) => (item as string).trim()))];
}

function sameStringSet(actual: string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && expected.every((entry) => actual.includes(entry));
}

function matchesOwnedPath(candidate: string, pattern: string): boolean {
  if (pattern.endsWith('/**')) {
    return candidate.startsWith(pattern.slice(0, -2));
  }
  return candidate === pattern;
}

export function isBaseTemplateProjectOwnedPath(candidate: string): boolean {
  return BASE_TEMPLATE_PROJECT_OWNED_PATHS.some((pattern) => matchesOwnedPath(candidate, pattern));
}

function validateProjectId(value: string): string {
  const normalized = value.trim();
  if (!PROJECT_ID_PATTERN.test(normalized)) {
    throw new Error(
      'Base project id must be 1-80 characters and use only letters, numbers, dot, underscore, or hyphen.',
    );
  }
  return normalized;
}

async function assertRequiredBaseFiles(templateRoot: string): Promise<void> {
  for (const relativePath of REQUIRED_BASE_FILES) {
    const info = await stat(path.join(templateRoot, ...relativePath.split('/'))).catch(() => null);
    if (!info?.isFile()) {
      throw new Error(`Yakable Base is missing required file: ${relativePath}`);
    }
  }
}

export async function readBaseTemplateManifest(
  templateRoot = path.resolve(process.cwd(), 'templates', 'base'),
): Promise<BaseTemplateManifest> {
  await assertRequiredBaseFiles(templateRoot);
  const raw = await readFile(path.join(templateRoot, 'yakable.template.json'), 'utf8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Yakable Base manifest is not valid JSON.');
  }

  if (!isRecord(parsed) || parsed.version !== BASE_TEMPLATE_VERSION || parsed.id !== BASE_TEMPLATE_ID) {
    throw new Error('Yakable Base manifest has an unsupported id or version.');
  }
  if (typeof parsed.description !== 'string' || !parsed.description.trim()) {
    throw new Error('Yakable Base manifest description is required.');
  }
  if (!isRecord(parsed.ownership)) {
    throw new Error('Yakable Base manifest ownership is required.');
  }

  const yakable = readStringArray(parsed.ownership.yakable, 'ownership.yakable');
  const project = readStringArray(parsed.ownership.project, 'ownership.project');
  const overlap = yakable.filter((entry) => project.includes(entry));
  if (overlap.length) {
    throw new Error(`Yakable Base ownership contains exact overlaps: ${overlap.join(', ')}`);
  }
  if (!sameStringSet(yakable, BASE_TEMPLATE_YAKABLE_OWNED_PATHS)) {
    throw new Error('Yakable Base manifest ownership.yakable does not match the runtime contract.');
  }
  if (!sameStringSet(project, BASE_TEMPLATE_PROJECT_OWNED_PATHS)) {
    throw new Error('Yakable Base manifest ownership.project does not match the runtime contract.');
  }

  return {
    version: BASE_TEMPLATE_VERSION,
    id: BASE_TEMPLATE_ID,
    description: parsed.description.trim(),
    ownership: { yakable, project },
  };
}

export async function createBaseProject(
  projectIdInput: string,
  options: CreateBaseProjectOptions = {},
): Promise<CreatedBaseProject> {
  const projectId = validateProjectId(projectIdInput);
  const outputRoot = options.outputRoot ?? path.resolve(process.cwd(), 'generated');
  const templateRoot = options.templateRoot ?? path.resolve(process.cwd(), 'templates', 'base');
  const destination = path.join(outputRoot, projectId);
  const existing = await stat(destination).catch(() => null);
  if (existing) {
    throw new Error(`Base project already exists: ${destination}`);
  }

  const manifest = await readBaseTemplateManifest(templateRoot);
  await mkdir(outputRoot, { recursive: true });
  await cp(templateRoot, destination, { recursive: true, errorOnExist: true, force: false });

  const now = new Date().toISOString();
  await writeProjectMetadata(
    destination,
    createProjectMetadata('website', [{ path: '/', title: 'Home' }], {
      name: options.displayName?.trim() || projectId,
      starred: false,
      createdAt: now,
      updatedAt: now,
    }),
  );

  return { id: projectId, directory: destination, manifest };
}
