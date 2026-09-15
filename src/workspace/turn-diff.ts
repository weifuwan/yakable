import type {
  WorkspaceChangeSet,
  WorkspaceFileChange,
  WorkspaceChangeType,
} from './change-set.js';
import {
  countUnifiedDiffStats,
  renderWorkspaceFileChangesDiff,
} from './unified-diff.js';

export interface WorkspaceTurnDiff {
  files: WorkspaceFileChange[];
  unifiedDiff: string;
  addedLines: number;
  removedLines: number;
}

function classifyNetChange(
  beforeContent: string | null,
  afterContent: string | null,
): WorkspaceChangeType | null {
  if (beforeContent === afterContent) return null;
  if (beforeContent === null) return 'ADDED';
  if (afterContent === null) return 'DELETED';
  return 'MODIFIED';
}

export class TurnDiffTracker {
  private readonly files = new Map<string, WorkspaceFileChange>();

  constructor(initial: WorkspaceTurnDiff | readonly WorkspaceFileChange[] | null = null) {
    const files = Array.isArray(initial) ? initial : initial?.files ?? [];
    for (const file of files) {
      this.files.set(file.path, { ...file });
    }
  }

  record(changeSet: WorkspaceChangeSet): void {
    for (const change of changeSet.files) {
      const existing = this.files.get(change.path);
      const beforeContent = existing?.beforeContent ?? change.beforeContent;
      const afterContent = change.afterContent;
      const type = classifyNetChange(beforeContent, afterContent);

      if (!type) {
        this.files.delete(change.path);
        continue;
      }

      this.files.set(change.path, {
        path: change.path,
        type,
        beforeContent,
        afterContent,
      });
    }
  }

  isEmpty(): boolean {
    return this.files.size === 0;
  }

  async snapshot(): Promise<WorkspaceTurnDiff> {
    const files = [...this.files.values()].map((file) => ({ ...file }));
    const unifiedDiff = await renderWorkspaceFileChangesDiff(files);
    const stats = countUnifiedDiffStats(unifiedDiff);
    return {
      files,
      unifiedDiff,
      addedLines: stats.addedLines,
      removedLines: stats.removedLines,
    };
  }
}
