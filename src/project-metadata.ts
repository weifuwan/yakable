import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ProjectMetadata, ProjectRoute, ProjectTemplate } from './types.js';

const METADATA_DIRECTORY = '.yakable';
const METADATA_FILENAME = 'project.json';
const DEFAULT_ROUTES: ProjectRoute[] = [{ path: '/', title: 'Home' }];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProjectTemplate(value: unknown): value is ProjectTemplate {
  return value === 'website' || value === 'app';
}

function normalizeRoutePath(value: string): string | null {
  const candidate = value.trim();
  if (!candidate.startsWith('/') || candidate.includes('?') || candidate.includes('#')) {
    return null;
  }

  if (candidate.length > 160 || candidate.includes('\\') || candidate.includes('//')) {
    return null;
  }

  if (candidate === '/') return '/';
  return candidate.replace(/\/+$/, '');
}

export function normalizeProjectRoutes(value: unknown): ProjectRoute[] {
  if (!Array.isArray(value)) return DEFAULT_ROUTES.map((route) => ({ ...route }));

  const routes: ProjectRoute[] = [];
  const seen = new Set<string>();

  for (const entry of value.slice(0, 20)) {
    if (!isRecord(entry) || typeof entry.path !== 'string') continue;

    const routePath = normalizeRoutePath(entry.path);
    if (!routePath || seen.has(routePath)) continue;

    seen.add(routePath);
    routes.push({
      path: routePath,
      title:
        typeof entry.title === 'string' && entry.title.trim()
          ? entry.title.trim().slice(0, 80)
          : routePath === '/'
            ? 'Home'
            : routePath
                .split('/')
                .filter(Boolean)
                .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
                .join(' '),
    });
  }

  if (!seen.has('/')) {
    routes.unshift({ path: '/', title: 'Home' });
  }

  return routes.length ? routes : DEFAULT_ROUTES.map((route) => ({ ...route }));
}

export function createProjectMetadata(
  template: ProjectTemplate,
  routes: ProjectRoute[],
): ProjectMetadata {
  return {
    version: 1,
    template,
    routes: normalizeProjectRoutes(routes),
  };
}

export async function writeProjectMetadata(
  projectDirectory: string,
  metadata: ProjectMetadata,
): Promise<void> {
  const metadataDirectory = path.join(projectDirectory, METADATA_DIRECTORY);
  await mkdir(metadataDirectory, { recursive: true });
  await writeFile(
    path.join(metadataDirectory, METADATA_FILENAME),
    `${JSON.stringify(metadata, null, 2)}\n`,
    'utf8',
  );
}

export async function readProjectMetadata(projectDirectory: string): Promise<ProjectMetadata> {
  const metadataPath = path.join(projectDirectory, METADATA_DIRECTORY, METADATA_FILENAME);
  const raw = await readFile(metadataPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });

  if (!raw) {
    return createProjectMetadata('website', DEFAULT_ROUTES);
  }

  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return createProjectMetadata('website', DEFAULT_ROUTES);

    return createProjectMetadata(
      isProjectTemplate(value.template) ? value.template : 'website',
      normalizeProjectRoutes(value.routes),
    );
  } catch {
    return createProjectMetadata('website', DEFAULT_ROUTES);
  }
}
