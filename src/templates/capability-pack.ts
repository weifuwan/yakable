import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { resolveGeneratedProject } from '../runtime/runtime.js';
import {
  BASE_TEMPLATE_ID,
  BASE_TEMPLATE_VERSION,
  readBaseTemplateManifest,
} from './base-template.js';

export const CAPABILITY_PACK_VERSION = 1 as const;
export const PROJECT_CAPABILITY_STATE_VERSION = 1 as const;

const PACK_ID_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;
const PACKAGE_NAME_PATTERN = /^(?:@[^/\s]+\/)?[^/\s]+$/;
const CAPABILITY_STATE_PATH = path.join('.yakable', 'capabilities.json');
const ALLOWED_PACK_FILE_PREFIX = 'src/components/ui/';

export interface CapabilityPackManifest {
  version: 1;
  id: string;
  description: string;
  base: {
    id: 'base';
    version: 1;
  };
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  files: string[];
}

export interface InstalledCapabilityPack {
  id: string;
  version: 1;
}

export interface ProjectCapabilityState {
  version: 1;
  base: {
    id: 'base';
    version: 1;
  };
  packs: InstalledCapabilityPack[];
}

export interface CapabilityDependencyChange {
  name: string;
  version: string;
  section: 'dependencies' | 'devDependencies';
}

export interface InstallCapabilityPacksOptions {
  generatedRoot?: string;
  packsRoot?: string;
}

export interface InstallCapabilityPacksResult {
  projectId: string;
  projectDirectory: string;
  installedPacks: string[];
  alreadyInstalledPacks: string[];
  addedFiles: string[];
  addedDependencies: CapabilityDependencyChange[];
  state: ProjectCapabilityState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePackId(value: string): string {
  const normalized = value.trim();
  if (!PACK_ID_PATTERN.test(normalized)) {
    throw new Error(
      'Capability pack id must start with a letter, be at most 40 characters, and use only lowercase letters, numbers, or hyphens.',
    );
  }
  return normalized;
}

function normalizePackFilePath(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Capability pack file paths must be non-empty strings.');
  }

  const candidate = value.trim();
  if (
    candidate.includes('\\') ||
    candidate.startsWith('/') ||
    path.posix.isAbsolute(candidate) ||
    /[\r\n]/.test(candidate)
  ) {
    throw new Error(`Capability pack file path is invalid: ${candidate}`);
  }

  const normalized = path.posix.normalize(candidate);
  const segments = candidate.split('/');
  if (
    normalized !== candidate ||
    segments.some((segment) => segment === '.' || segment === '..') ||
    !candidate.startsWith(ALLOWED_PACK_FILE_PREFIX)
  ) {
    throw new Error(
      `Capability pack files must stay inside ${ALLOWED_PACK_FILE_PREFIX}*: ${candidate}`,
    );
  }

  return candidate;
}

function readDependencyMap(value: unknown, field: string): Record<string, string> {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    throw new Error(`Capability pack ${field} must be an object.`);
  }

  const entries: Array<[string, string]> = [];
  for (const [name, version] of Object.entries(value)) {
    if (!PACKAGE_NAME_PATTERN.test(name) || typeof version !== 'string' || !version.trim()) {
      throw new Error(`Capability pack ${field} contains an invalid dependency: ${name}`);
    }
    entries.push([name, version.trim()]);
  }

  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

function readPackFiles(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Capability pack files must be a non-empty array.');
  }

  const files = value.map(normalizePackFilePath);
  const unique = [...new Set(files)];
  if (unique.length !== files.length) {
    throw new Error('Capability pack files must not contain duplicate paths.');
  }
  return unique.sort();
}

async function assertManifestFiles(packDirectory: string, files: string[]): Promise<void> {
  for (const relativePath of files) {
    const source = path.join(packDirectory, 'files', ...relativePath.split('/'));
    const info = await stat(source).catch(() => null);
    if (!info?.isFile()) {
      throw new Error(`Capability pack is missing declared file: ${relativePath}`);
    }
  }
}

export async function readCapabilityPackManifest(
  packIdInput: string,
  packsRoot = path.resolve(process.cwd(), 'templates', 'packs'),
): Promise<CapabilityPackManifest> {
  const packId = normalizePackId(packIdInput);
  const packDirectory = path.join(packsRoot, packId);
  const raw = await readFile(path.join(packDirectory, 'pack.json'), 'utf8').catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        throw new Error(`Capability pack does not exist: ${packId}`);
      }
      throw error;
    },
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Capability pack manifest is not valid JSON: ${packId}`);
  }

  if (!isRecord(parsed) || parsed.version !== CAPABILITY_PACK_VERSION || parsed.id !== packId) {
    throw new Error(`Capability pack ${packId} has an unsupported id or version.`);
  }
  if (typeof parsed.description !== 'string' || !parsed.description.trim()) {
    throw new Error(`Capability pack ${packId} requires a description.`);
  }
  if (
    !isRecord(parsed.base) ||
    parsed.base.id !== BASE_TEMPLATE_ID ||
    parsed.base.version !== BASE_TEMPLATE_VERSION
  ) {
    throw new Error(`Capability pack ${packId} is not compatible with Yakable Base v1.`);
  }

  const manifest: CapabilityPackManifest = {
    version: CAPABILITY_PACK_VERSION,
    id: packId,
    description: parsed.description.trim(),
    base: { id: BASE_TEMPLATE_ID, version: BASE_TEMPLATE_VERSION },
    dependencies: readDependencyMap(parsed.dependencies, 'dependencies'),
    devDependencies: readDependencyMap(parsed.devDependencies, 'devDependencies'),
    files: readPackFiles(parsed.files),
  };

  await assertManifestFiles(packDirectory, manifest.files);
  return manifest;
}

export async function listCapabilityPacks(
  packsRoot = path.resolve(process.cwd(), 'templates', 'packs'),
): Promise<CapabilityPackManifest[]> {
  const entries = await readdir(packsRoot, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    },
  );

  const packIds = entries
    .filter((entry) => entry.isDirectory() && PACK_ID_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  return Promise.all(packIds.map((packId) => readCapabilityPackManifest(packId, packsRoot)));
}

function emptyCapabilityState(): ProjectCapabilityState {
  return {
    version: PROJECT_CAPABILITY_STATE_VERSION,
    base: { id: BASE_TEMPLATE_ID, version: BASE_TEMPLATE_VERSION },
    packs: [],
  };
}

function parseCapabilityState(value: unknown): ProjectCapabilityState {
  if (!isRecord(value) || value.version !== PROJECT_CAPABILITY_STATE_VERSION) {
    throw new Error('Project capability state has an unsupported version.');
  }
  if (
    !isRecord(value.base) ||
    value.base.id !== BASE_TEMPLATE_ID ||
    value.base.version !== BASE_TEMPLATE_VERSION
  ) {
    throw new Error('Project capability state does not target Yakable Base v1.');
  }
  if (!Array.isArray(value.packs)) {
    throw new Error('Project capability state packs must be an array.');
  }

  const seen = new Set<string>();
  const packs: InstalledCapabilityPack[] = [];
  for (const entry of value.packs) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || entry.version !== CAPABILITY_PACK_VERSION) {
      throw new Error('Project capability state contains an invalid pack entry.');
    }
    const id = normalizePackId(entry.id);
    if (seen.has(id)) continue;
    seen.add(id);
    packs.push({ id, version: CAPABILITY_PACK_VERSION });
  }

  packs.sort((left, right) => left.id.localeCompare(right.id));
  return {
    version: PROJECT_CAPABILITY_STATE_VERSION,
    base: { id: BASE_TEMPLATE_ID, version: BASE_TEMPLATE_VERSION },
    packs,
  };
}

export async function readProjectCapabilityState(
  projectDirectory: string,
): Promise<ProjectCapabilityState> {
  const statePath = path.join(projectDirectory, CAPABILITY_STATE_PATH);
  const raw = await readFile(statePath, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });

  if (!raw) return emptyCapabilityState();

  try {
    return parseCapabilityState(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Project capability state is not valid JSON.');
    }
    throw error;
  }
}

async function writeProjectCapabilityState(
  projectDirectory: string,
  state: ProjectCapabilityState,
): Promise<void> {
  const statePath = path.join(projectDirectory, CAPABILITY_STATE_PATH);
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function readProjectDependencySection(
  packageJson: Record<string, unknown>,
  section: 'dependencies' | 'devDependencies',
): Record<string, string> {
  const value = packageJson[section];
  if (value === undefined) return {};
  if (!isRecord(value)) {
    throw new Error(`Project package.json ${section} must be an object.`);
  }

  const result: Record<string, string> = {};
  for (const [name, version] of Object.entries(value)) {
    if (typeof version !== 'string') {
      throw new Error(`Project package.json ${section}.${name} must be a string.`);
    }
    result[name] = version;
  }
  return result;
}

function collectPackRequirements(
  manifests: CapabilityPackManifest[],
  section: 'dependencies' | 'devDependencies',
): Map<string, { version: string; packId: string }> {
  const requirements = new Map<string, { version: string; packId: string }>();

  for (const manifest of manifests) {
    for (const [name, version] of Object.entries(manifest[section])) {
      const existing = requirements.get(name);
      if (existing && existing.version !== version) {
        throw new Error(
          `Capability packs ${existing.packId} and ${manifest.id} require conflicting versions of ${name}: ${existing.version} vs ${version}.`,
        );
      }
      if (!existing) requirements.set(name, { version, packId: manifest.id });
    }
  }

  return requirements;
}

function mergePackageDependencies(
  packageJson: Record<string, unknown>,
  manifests: CapabilityPackManifest[],
): { next: Record<string, unknown>; added: CapabilityDependencyChange[] } {
  const currentDependencies = readProjectDependencySection(packageJson, 'dependencies');
  const currentDevDependencies = readProjectDependencySection(packageJson, 'devDependencies');
  const requiredDependencies = collectPackRequirements(manifests, 'dependencies');
  const requiredDevDependencies = collectPackRequirements(manifests, 'devDependencies');

  for (const name of requiredDependencies.keys()) {
    if (requiredDevDependencies.has(name)) {
      throw new Error(`Capability pack dependency ${name} is declared in both dependency sections.`);
    }
  }

  const nextDependencies = { ...currentDependencies };
  const nextDevDependencies = { ...currentDevDependencies };
  const added: CapabilityDependencyChange[] = [];

  const mergeSection = (
    section: 'dependencies' | 'devDependencies',
    current: Record<string, string>,
    opposite: Record<string, string>,
    target: Record<string, string>,
    requirements: Map<string, { version: string; packId: string }>,
  ) => {
    for (const [name, requirement] of [...requirements.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (name in opposite) {
        throw new Error(
          `Capability pack ${requirement.packId} requires ${name} in ${section}, but the project already declares it in the other dependency section.`,
        );
      }

      const existing = current[name];
      if (existing && existing !== requirement.version) {
        throw new Error(
          `Capability pack ${requirement.packId} requires ${name}@${requirement.version}, but the project already declares ${name}@${existing}.`,
        );
      }

      if (!existing) {
        target[name] = requirement.version;
        added.push({ name, version: requirement.version, section });
      }
    }
  };

  mergeSection(
    'dependencies',
    currentDependencies,
    currentDevDependencies,
    nextDependencies,
    requiredDependencies,
  );
  mergeSection(
    'devDependencies',
    currentDevDependencies,
    currentDependencies,
    nextDevDependencies,
    requiredDevDependencies,
  );

  const sortRecord = (value: Record<string, string>) =>
    Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));

  return {
    next: {
      ...packageJson,
      dependencies: sortRecord(nextDependencies),
      devDependencies: sortRecord(nextDevDependencies),
    },
    added,
  };
}

export async function installCapabilityPacks(
  projectInput: string,
  packIdsInput: string[],
  options: InstallCapabilityPacksOptions = {},
): Promise<InstallCapabilityPacksResult> {
  if (!Array.isArray(packIdsInput) || packIdsInput.length === 0) {
    throw new Error('At least one capability pack id is required.');
  }

  const packIds = [...new Set(packIdsInput.map(normalizePackId))].sort();
  const generatedRoot = options.generatedRoot ?? path.resolve(process.cwd(), 'generated');
  const packsRoot = options.packsRoot ?? path.resolve(process.cwd(), 'templates', 'packs');
  const project = await resolveGeneratedProject(projectInput, generatedRoot);

  await readBaseTemplateManifest(project.directory);
  const state = await readProjectCapabilityState(project.directory);
  const manifests = await Promise.all(
    packIds.map((packId) => readCapabilityPackManifest(packId, packsRoot)),
  );

  const packagePath = path.join(project.directory, 'package.json');
  const rawPackage = await readFile(packagePath, 'utf8');
  let packageJson: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawPackage);
    if (!isRecord(parsed)) throw new Error('Project package.json must contain a JSON object.');
    packageJson = parsed;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Project package.json is not valid JSON.');
    throw error;
  }

  const packagePlan = mergePackageDependencies(packageJson, manifests);
  const fileOwners = new Map<string, string>();
  const plannedFiles: Array<{ relativePath: string; content: Buffer; shouldWrite: boolean }> = [];

  for (const manifest of manifests) {
    for (const relativePath of manifest.files) {
      const owner = fileOwners.get(relativePath);
      if (owner) {
        throw new Error(
          `Capability packs ${owner} and ${manifest.id} both own ${relativePath}; pack files must have one owner.`,
        );
      }
      fileOwners.set(relativePath, manifest.id);

      const source = path.join(packsRoot, manifest.id, 'files', ...relativePath.split('/'));
      const destination = path.join(project.directory, ...relativePath.split('/'));
      const content = await readFile(source);
      const existing = await readFile(destination).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return null;
        throw error;
      });

      if (existing && !existing.equals(content)) {
        throw new Error(
          `Capability pack ${manifest.id} would overwrite an existing Yakable UI file: ${relativePath}`,
        );
      }

      plannedFiles.push({ relativePath, content, shouldWrite: existing === null });
    }
  }

  const installedIds = new Set(state.packs.map((pack) => pack.id));
  const installedPacks = packIds.filter((packId) => !installedIds.has(packId));
  const alreadyInstalledPacks = packIds.filter((packId) => installedIds.has(packId));

  for (const file of plannedFiles) {
    if (!file.shouldWrite) continue;
    const destination = path.join(project.directory, ...file.relativePath.split('/'));
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.content, { flag: 'wx' });
  }

  const nextPackageText = `${JSON.stringify(packagePlan.next, null, 2)}\n`;
  if (nextPackageText !== rawPackage) {
    await writeFile(packagePath, nextPackageText, 'utf8');
  }

  const nextState: ProjectCapabilityState = {
    version: PROJECT_CAPABILITY_STATE_VERSION,
    base: { id: BASE_TEMPLATE_ID, version: BASE_TEMPLATE_VERSION },
    packs: [
      ...state.packs,
      ...installedPacks.map((id) => ({ id, version: CAPABILITY_PACK_VERSION as 1 })),
    ]
      .filter((pack, index, packs) => packs.findIndex((candidate) => candidate.id === pack.id) === index)
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
  await writeProjectCapabilityState(project.directory, nextState);

  return {
    projectId: project.id,
    projectDirectory: project.directory,
    installedPacks,
    alreadyInstalledPacks,
    addedFiles: plannedFiles.filter((file) => file.shouldWrite).map((file) => file.relativePath).sort(),
    addedDependencies: packagePlan.added.sort((left, right) => left.name.localeCompare(right.name)),
    state: nextState,
  };
}
