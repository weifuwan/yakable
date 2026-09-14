import { randomUUID } from 'node:crypto';
import { cp, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

import { resolveGeneratedProject } from '../runtime/runtime.js';
import { deleteProjectAgentRuns } from '../storage/agent-run.js';
import type { ProjectMetadata, ProjectTemplate } from '../types.js';
import { createProjectMetadata, readProjectMetadata, writeProjectMetadata } from './project-metadata.js';
import { cloneProjectSession, deleteProjectSession } from './project-session.js';

export interface ProjectListRecord {
  id: string;
  name: string;
  updatedAt: string;
  createdAt?: string;
  starred: boolean;
  template: ProjectTemplate;
  remixedFrom?: string;
}

export interface ProjectUpdate {
  name?: string;
  starred?: boolean;
}

function defaultProjectName(projectId: string): string {
  const base = projectId.replace(/-\d{4}-\d{2}-\d{2}T.*$/, '');
  return (base || projectId)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizedProjectName(value: string): string {
  const name = value.trim();
  if (!name) throw new Error('Project name is required.');
  if (name.length > 80) throw new Error('Project name is too long (max 80 characters).');
  return name;
}

async function projectRecord(
  projectId: string,
  projectDirectory: string,
  metadata?: ProjectMetadata,
): Promise<ProjectListRecord> {
  const resolvedMetadata = metadata ?? (await readProjectMetadata(projectDirectory));
  const info = await stat(projectDirectory);
  return {
    id: projectId,
    name: resolvedMetadata.name ?? defaultProjectName(projectId),
    updatedAt: resolvedMetadata.updatedAt ?? info.mtime.toISOString(),
    ...(resolvedMetadata.createdAt ? { createdAt: resolvedMetadata.createdAt } : {}),
    starred: resolvedMetadata.starred ?? false,
    template: resolvedMetadata.template,
    ...(resolvedMetadata.remixedFrom ? { remixedFrom: resolvedMetadata.remixedFrom } : {}),
  };
}

export async function listManagedProjects(
  generatedRoot = path.resolve(process.cwd(), 'generated'),
): Promise<ProjectListRecord[]> {
  const entries = await readdir(generatedRoot, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    },
  );

  const projects = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const directory = path.join(generatedRoot, entry.name);
        return projectRecord(entry.name, directory);
      }),
  );

  return projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function updateManagedProject(
  projectId: string,
  patch: ProjectUpdate,
  generatedRoot = path.resolve(process.cwd(), 'generated'),
): Promise<ProjectListRecord> {
  if (typeof patch.name !== 'string' && typeof patch.starred !== 'boolean') {
    throw new Error('Project update must include a name or starred value.');
  }

  const project = await resolveGeneratedProject(projectId, generatedRoot);
  const current = await readProjectMetadata(project.directory);
  const now = new Date().toISOString();
  const next = createProjectMetadata(current.template, current.routes, {
    ...current,
    ...(typeof patch.name === 'string' ? { name: normalizedProjectName(patch.name) } : {}),
    ...(typeof patch.starred === 'boolean' ? { starred: patch.starred } : {}),
    updatedAt: now,
  });

  await writeProjectMetadata(project.directory, next);
  return projectRecord(project.id, project.directory, next);
}

export async function touchManagedProject(
  projectId: string,
  generatedRoot = path.resolve(process.cwd(), 'generated'),
): Promise<void> {
  const project = await resolveGeneratedProject(projectId, generatedRoot);
  const current = await readProjectMetadata(project.directory);
  await writeProjectMetadata(
    project.directory,
    createProjectMetadata(current.template, current.routes, {
      ...current,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function remixManagedProject(
  projectId: string,
  generatedRoot = path.resolve(process.cwd(), 'generated'),
): Promise<ProjectListRecord> {
  const source = await resolveGeneratedProject(projectId, generatedRoot);
  const metadata = await readProjectMetadata(source.directory);
  const createdAt = new Date().toISOString();
  const timestamp = createdAt.replace(/[:.]/g, '-');
  const sourceBase = projectId.replace(/-\d{4}-\d{2}-\d{2}T.*$/, '').slice(0, 38) || 'project';
  const remixId = `${sourceBase}-remix-${timestamp}-${randomUUID().slice(0, 8)}`;
  const destination = path.join(generatedRoot, remixId);

  await cp(source.directory, destination, { recursive: true, errorOnExist: true });

  const nextMetadata = createProjectMetadata(metadata.template, metadata.routes, {
    ...metadata,
    name: `${metadata.name ?? defaultProjectName(projectId)} Copy`,
    starred: false,
    createdAt,
    updatedAt: createdAt,
    remixedFrom: projectId,
  });
  await writeProjectMetadata(destination, nextMetadata);
  await cloneProjectSession(source.directory, destination, createdAt);

  return projectRecord(remixId, destination, nextMetadata);
}

export async function deleteManagedProject(
  projectId: string,
  generatedRoot = path.resolve(process.cwd(), 'generated'),
): Promise<void> {
  const project = await resolveGeneratedProject(projectId, generatedRoot);
  await rm(project.directory, { recursive: true, force: false });
  await deleteProjectSession(project.directory);
  deleteProjectAgentRuns(projectId);
}
