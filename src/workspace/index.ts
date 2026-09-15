export {
  WorkspaceChangeApplyError,
  WorkspaceChangeConflictError,
  WorkspaceChangeManager,
  validateWorkspacePath,
} from './change-manager.js';
export type { WorkspaceChangeManagerOptions } from './change-manager.js';
export {
  workspaceChangedPaths,
  workspaceMutationsFromFiles,
} from './change-set.js';
export type {
  WorkspaceChangeSet,
  WorkspaceChangeType,
  WorkspaceFileChange,
  WorkspaceMutation,
} from './change-set.js';
