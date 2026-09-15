import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { WorkspaceFileChange } from './change-set.js';
import { runGitCommand } from './git-command.js';

export interface UnifiedDiffStats {
  addedLines: number;
  removedLines: number;
}

function contentLines(content: string): string[] {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (normalized.endsWith('\n')) lines.pop();
  return lines;
}

function manualAddedDiff(change: WorkspaceFileChange): string {
  const lines = contentLines(change.afterContent ?? '');
  const body = lines.map((line) => `+${line}`).join('\n');
  return [
    `diff --git a/${change.path} b/${change.path}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${change.path}`,
    `@@ -0,0 +1,${lines.length} @@`,
    body,
  ].filter((line) => line.length > 0).join('\n');
}

function manualDeletedDiff(change: WorkspaceFileChange): string {
  const lines = contentLines(change.beforeContent ?? '');
  const body = lines.map((line) => `-${line}`).join('\n');
  return [
    `diff --git a/${change.path} b/${change.path}`,
    'deleted file mode 100644',
    `--- a/${change.path}`,
    '+++ /dev/null',
    `@@ -1,${lines.length} +0,0 @@`,
    body,
  ].filter((line) => line.length > 0).join('\n');
}

function normalizeTempDiff(raw: string, relativePath: string): string {
  return raw
    .split(`a/before/${relativePath}`).join(`a/${relativePath}`)
    .split(`b/after/${relativePath}`).join(`b/${relativePath}`)
    .trim();
}

async function modifiedDiff(change: WorkspaceFileChange): Promise<string> {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'yakable-turn-diff-'));
  try {
    const beforePath = path.join(temp, 'before', ...change.path.split('/'));
    const afterPath = path.join(temp, 'after', ...change.path.split('/'));
    await mkdir(path.dirname(beforePath), { recursive: true });
    await mkdir(path.dirname(afterPath), { recursive: true });
    await writeFile(beforePath, change.beforeContent ?? '', 'utf8');
    await writeFile(afterPath, change.afterContent ?? '', 'utf8');

    const result = await runGitCommand(
      temp,
      [
        'diff',
        '--no-index',
        '--no-ext-diff',
        '--no-textconv',
        '--no-renames',
        '--unified=3',
        '--',
        `before/${change.path}`,
        `after/${change.path}`,
      ],
      { acceptExitCodes: [0, 1] },
    );
    return normalizeTempDiff(result.stdout, change.path);
  } finally {
    await rm(temp, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function renderWorkspaceFileChangesDiff(
  files: readonly WorkspaceFileChange[],
): Promise<string> {
  const sections: string[] = [];
  for (const file of files) {
    if (file.type === 'ADDED') {
      sections.push(manualAddedDiff(file));
    } else if (file.type === 'DELETED') {
      sections.push(manualDeletedDiff(file));
    } else {
      const rendered = await modifiedDiff(file);
      if (rendered) sections.push(rendered);
    }
  }
  return sections.filter(Boolean).join('\n');
}

export function countUnifiedDiffStats(unifiedDiff: string): UnifiedDiffStats {
  let addedLines = 0;
  let removedLines = 0;
  for (const line of unifiedDiff.split(/\r?\n/)) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) addedLines += 1;
    else if (line.startsWith('-')) removedLines += 1;
  }
  return { addedLines, removedLines };
}
