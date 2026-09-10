import { createHash } from 'node:crypto';

import {
  listProjectSourceFiles,
  restoreProjectSourceFiles,
  type ProjectSourceFile,
} from '../project/project-store.js';

const MAX_VERSIONS_PER_PROJECT = 20;
const MAX_VERSION_HISTORIES = 100;
const VERSION_HISTORY_TTL_MS = 4 * 60 * 60 * 1000;
const MAX_LABEL_LENGTH = 120;
const PREVIEW_LINE_LIMIT = 8;

export type ProjectVersionOrigin = 'agent' | 'repair' | 'rollback';

export interface ProjectVersionSummary {
  id: string;
  number: number;
  createdAt: string;
  label: string;
  origin: ProjectVersionOrigin;
  sourceVersionId?: string;
  changedFiles: string[];
  additions: number;
  deletions: number;
}

export interface ProjectVersionFileDiff {
  path: string;
  status: 'added' | 'modified' | 'removed';
  additions: number;
  deletions: number;
  beforePreview: string[];
  afterPreview: string[];
}

export interface ProjectVersionDiff {
  version: ProjectVersionSummary;
  against?: ProjectVersionSummary;
  files: ProjectVersionFileDiff[];
  additions: number;
  deletions: number;
}

interface StoredVersion extends ProjectVersionSummary {
  fingerprint: string;
  files: ProjectSourceFile[];
}

interface ProjectVersionHistory {
  nextNumber: number;
  versions: StoredVersion[];
  updatedAt: number;
}

export interface CaptureStableVersionInput {
  label: string;
  origin: ProjectVersionOrigin;
  sourceVersionId?: string;
}

export interface CaptureStableVersionResult {
  version: ProjectVersionSummary;
  created: boolean;
}

export interface RollbackProjectVersionResult {
  target: ProjectVersionSummary;
  changedFiles: string[];
}

const histories = new Map<string, ProjectVersionHistory>();

function cloneFiles(files: ProjectSourceFile[]) {
  return files.map((file) => ({ path: file.path, content: file.content }));
}

function summary(version: StoredVersion): ProjectVersionSummary {
  return {
    id: version.id,
    number: version.number,
    createdAt: version.createdAt,
    label: version.label,
    origin: version.origin,
    sourceVersionId: version.sourceVersionId,
    changedFiles: [...version.changedFiles],
    additions: version.additions,
    deletions: version.deletions,
  };
}

function normalizeLabel(value: string) {
  const label = value.trim().replace(/\s+/g, ' ');
  return (label || 'Stable preview').slice(0, MAX_LABEL_LENGTH);
}

function fingerprint(files: ProjectSourceFile[]) {
  const hash = createHash('sha256');
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(file.path);
    hash.update('\0');
    hash.update(file.content);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function lines(content: string) {
  if (!content) {
    return [];
  }
  return content.replace(/\r\n/g, '\n').split('\n');
}

function changedWindow(before: string[], after: string[]) {
  let prefix = 0;
  while (
    prefix < before.length &&
    prefix < after.length &&
    before[prefix] === after[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const beforeChanged = before.slice(prefix, before.length - suffix);
  const afterChanged = after.slice(prefix, after.length - suffix);

  return {
    additions: afterChanged.length,
    deletions: beforeChanged.length,
    beforePreview: beforeChanged.slice(0, PREVIEW_LINE_LIMIT),
    afterPreview: afterChanged.slice(0, PREVIEW_LINE_LIMIT),
  };
}

function diffFiles(
  beforeFiles: ProjectSourceFile[],
  afterFiles: ProjectSourceFile[],
): ProjectVersionFileDiff[] {
  const before = new Map(beforeFiles.map((file) => [file.path, file.content]));
  const after = new Map(afterFiles.map((file) => [file.path, file.content]));
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  const result: ProjectVersionFileDiff[] = [];

  for (const path of paths) {
    const previous = before.get(path);
    const current = after.get(path);

    if (previous === current) {
      continue;
    }

    if (previous === undefined && current !== undefined) {
      const afterLines = lines(current);
      result.push({
        path,
        status: 'added',
        additions: afterLines.length,
        deletions: 0,
        beforePreview: [],
        afterPreview: afterLines.slice(0, PREVIEW_LINE_LIMIT),
      });
      continue;
    }

    if (previous !== undefined && current === undefined) {
      const beforeLines = lines(previous);
      result.push({
        path,
        status: 'removed',
        additions: 0,
        deletions: beforeLines.length,
        beforePreview: beforeLines.slice(0, PREVIEW_LINE_LIMIT),
        afterPreview: [],
      });
      continue;
    }

    const delta = changedWindow(lines(previous ?? ''), lines(current ?? ''));
    result.push({
      path,
      status: 'modified',
      ...delta,
    });
  }

  return result;
}

function sweepHistories(now: number) {
  for (const [projectId, history] of histories) {
    if (now - history.updatedAt > VERSION_HISTORY_TTL_MS) {
      histories.delete(projectId);
    }
  }
}

function getHistory(projectId: string) {
  const now = Date.now();
  sweepHistories(now);

  let history = histories.get(projectId);
  if (!history) {
    if (histories.size >= MAX_VERSION_HISTORIES) {
      const oldest = [...histories.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0];
      if (oldest) {
        histories.delete(oldest[0]);
      }
    }

    history = { nextNumber: 1, versions: [], updatedAt: now };
    histories.set(projectId, history);
  } else {
    history.updatedAt = now;
  }

  return history;
}

function requireVersion(projectId: string, versionId: string) {
  const version = getHistory(projectId).versions.find((item) => item.id === versionId);
  if (!version) {
    throw new Error(`Unknown project version: ${versionId}`);
  }
  return version;
}

export function listProjectVersions(projectId: string) {
  return getHistory(projectId).versions.map(summary).reverse();
}

export function captureStableVersion(
  projectId: string,
  input: CaptureStableVersionInput,
): CaptureStableVersionResult {
  const history = getHistory(projectId);
  const files = listProjectSourceFiles(projectId);
  const nextFingerprint = fingerprint(files);
  const latest = history.versions.at(-1);

  if (latest?.fingerprint === nextFingerprint) {
    return { version: summary(latest), created: false };
  }

  const previousFiles = latest?.files ?? [];
  const fileDiffs = diffFiles(previousFiles, files);
  const number = history.nextNumber;
  history.nextNumber += 1;

  const version: StoredVersion = {
    id: `v${number}`,
    number,
    createdAt: new Date().toISOString(),
    label: normalizeLabel(input.label),
    origin: input.origin,
    sourceVersionId: input.sourceVersionId,
    changedFiles: fileDiffs.map((file) => file.path),
    additions: fileDiffs.reduce((total, file) => total + file.additions, 0),
    deletions: fileDiffs.reduce((total, file) => total + file.deletions, 0),
    fingerprint: nextFingerprint,
    files: cloneFiles(files),
  };

  history.versions.push(version);
  if (history.versions.length > MAX_VERSIONS_PER_PROJECT) {
    history.versions.splice(0, history.versions.length - MAX_VERSIONS_PER_PROJECT);
  }

  return { version: summary(version), created: true };
}

export function getProjectVersionDiff(projectId: string, versionId: string): ProjectVersionDiff {
  const history = getHistory(projectId);
  const index = history.versions.findIndex((item) => item.id === versionId);
  if (index < 0) {
    throw new Error(`Unknown project version: ${versionId}`);
  }

  const version = history.versions[index];
  const against = index > 0 ? history.versions[index - 1] : undefined;
  const files = diffFiles(against?.files ?? [], version.files);

  return {
    version: summary(version),
    against: against ? summary(against) : undefined,
    files,
    additions: files.reduce((total, file) => total + file.additions, 0),
    deletions: files.reduce((total, file) => total + file.deletions, 0),
  };
}

export function rollbackProjectVersion(
  projectId: string,
  versionId: string,
): RollbackProjectVersionResult {
  const target = requireVersion(projectId, versionId);
  const currentFiles = listProjectSourceFiles(projectId);
  const changedFiles = diffFiles(currentFiles, target.files).map((file) => file.path);

  restoreProjectSourceFiles(projectId, cloneFiles(target.files));

  return {
    target: summary(target),
    changedFiles,
  };
}
