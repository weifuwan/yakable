import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { runGitCommand } from './git-command.js';

export const YAKABLE_GIT_BASELINE_MESSAGE = 'Initialize Yakable workspace baseline';
export const YAKABLE_GIT_EXCLUDES = ['.yakable/', 'node_modules/', 'dist/'] as const;

export interface WorkspaceGitBaseline {
  commit: string;
}

async function assertDirectory(root: string): Promise<void> {
  const info = await stat(root).catch(() => null);
  if (!info?.isDirectory()) {
    throw new Error(`Workspace directory does not exist: ${root}`);
  }
}

async function writeInternalExclude(root: string): Promise<void> {
  const infoDirectory = path.join(root, '.git', 'info');
  await mkdir(infoDirectory, { recursive: true });
  await writeFile(
    path.join(infoDirectory, 'exclude'),
    `${YAKABLE_GIT_EXCLUDES.join('\n')}\n`,
    'utf8',
  );
}

export async function readWorkspaceBaselineCommit(root: string): Promise<string> {
  const result = await runGitCommand(root, ['rev-parse', '--verify', 'HEAD']);
  const commit = result.stdout.trim();
  if (!/^[0-9a-f]{40}$/i.test(commit)) {
    throw new Error('Workspace Git baseline did not resolve to a commit SHA.');
  }
  return commit;
}

export async function initializeWorkspaceGitBaseline(
  rootInput: string,
): Promise<WorkspaceGitBaseline> {
  const root = path.resolve(rootInput);
  await assertDirectory(root);

  const existingGit = await stat(path.join(root, '.git')).catch(() => null);
  if (existingGit) {
    throw new Error(`Workspace Git baseline already exists: ${root}`);
  }

  await runGitCommand(root, ['init', '--quiet']);
  try {
    await runGitCommand(root, ['config', 'core.autocrlf', 'false']);
    await runGitCommand(root, ['config', 'core.filemode', 'false']);
    await runGitCommand(root, ['config', 'commit.gpgSign', 'false']);
    await writeInternalExclude(root);
    await runGitCommand(root, ['add', '--all']);
    await runGitCommand(root, [
      '-c',
      'user.name=Yakable',
      '-c',
      'user.email=workspace@yakable.local',
      '-c',
      'core.hooksPath=',
      'commit',
      '--quiet',
      '--allow-empty',
      '-m',
      YAKABLE_GIT_BASELINE_MESSAGE,
    ]);
    return { commit: await readWorkspaceBaselineCommit(root) };
  } catch (error) {
    await rm(path.join(root, '.git'), { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export async function resetWorkspaceGitBaseline(
  rootInput: string,
): Promise<WorkspaceGitBaseline> {
  const root = path.resolve(rootInput);
  await assertDirectory(root);
  await rm(path.join(root, '.git'), { recursive: true, force: true });
  return initializeWorkspaceGitBaseline(root);
}
