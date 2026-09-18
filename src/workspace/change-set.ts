export type WorkspaceChangeType = 'ADDED' | 'MODIFIED' | 'DELETED';

export interface WorkspaceMutation {
  path: string;
  /** Final UTF-8 text content. null means delete the file. */
  content: string | null;
}

export interface WorkspaceFileChange {
  path: string;
  type: WorkspaceChangeType;
  beforeContent: string | null;
  afterContent: string | null;
}

export interface WorkspaceChangeSet {
  id: string;
  summary: string;
  createdAt: string;
  files: WorkspaceFileChange[];
}

export function workspaceChangedPaths(changeSet: WorkspaceChangeSet): string[] {
  return changeSet.files.map((file) => file.path);
}

export function workspaceMutationsFromFiles(
  files: Array<{ path: string; content: string }>,
): WorkspaceMutation[] {
  return files.map((file) => ({ path: file.path, content: file.content }));
}
