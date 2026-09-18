import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { WorkspaceChangeType, WorkspaceFileChange } from './change-set.js';
import { readWorkspaceBaselineCommit } from './git-baseline.js';
import { runGitCommand } from './git-command.js';
import {
  countUnifiedDiffStats,
  renderWorkspaceFileChangesDiff,
} from './unified-diff.js';

export interface WorkspaceDiffFile {
  path: string;
  type: WorkspaceChangeType;
}

export interface WorkspaceDiffSnapshot {
  baselineCommit: string;
  files: WorkspaceDiffFile[];
  unifiedDiff: string;
  addedLines: number;
  removedLines: number;
}

function parseNameStatus(raw: string): WorkspaceDiffFile[] {
  const tokens = raw.split('\0').filter(Boolean);
  const files: WorkspaceDiffFile[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    let status = '';
    let filePath = '';
    const tab = token.indexOf('\t');

    if (tab >= 0) {
      status = token.slice(0, tab);
      filePath = token.slice(tab + 1);
    } else if (/^[AMD]$/.test(token)) {
      status = token;
      filePath = tokens[++index] ?? '';
    } else {
      throw new Error(`Unsupported Git name-status record: ${token}`);
    }

    if (!filePath) throw new Error('Git name-status returned an empty path.');
    files.push({
      path: filePath,
      type: status === 'A' ? 'ADDED' : status === 'D' ? 'DELETED' : 'MODIFIED',
    });
  }

  return files;
}

async function readUntrackedFiles(root: string): Promise<WorkspaceFileChange[]> {
  const result = await runGitCommand(root, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
  ]);
  const paths = result.stdout.split('\0').filter(Boolean).sort();
  const changes: WorkspaceFileChange[] = [];

  for (const relativePath of paths) {
    const content = await readFile(path.join(root, ...relativePath.split('/')), 'utf8');
    changes.push({
      path: relativePath,
      type: 'ADDED',
      beforeContent: null,
      afterContent: content,
    });
  }
  return changes;
}

export async function readWorkspaceDiff(
  rootInput: string,
): Promise<WorkspaceDiffSnapshot> {
  const root = path.resolve(rootInput);
  const baselineCommit = await readWorkspaceBaselineCommit(root);

  const trackedNames = await runGitCommand(root, [
    'diff',
    '--name-status',
    '-z',
    '--no-renames',
    baselineCommit,
    '--',
  ]);
  const trackedFiles = parseNameStatus(trackedNames.stdout);

  const trackedDiff = await runGitCommand(root, [
    'diff',
    '--no-ext-diff',
    '--no-textconv',
    '--no-renames',
    '--unified=3',
    '--src-prefix=a/',
    '--dst-prefix=b/',
    baselineCommit,
    '--',
  ]);

  const untrackedChanges = await readUntrackedFiles(root);
  const untrackedDiff = await renderWorkspaceFileChangesDiff(untrackedChanges);
  const files = [
    ...trackedFiles,
    ...untrackedChanges.map((file) => ({ path: file.path, type: file.type })),
  ];
  const unifiedDiff = [trackedDiff.stdout.trim(), untrackedDiff.trim()]
    .filter(Boolean)
    .join('\n');
  const stats = countUnifiedDiffStats(unifiedDiff);

  return {
    baselineCommit,
    files,
    unifiedDiff,
    addedLines: stats.addedLines,
    removedLines: stats.removedLines,
  };
}
