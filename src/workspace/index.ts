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
export {
  YAKABLE_GIT_BASELINE_MESSAGE,
  YAKABLE_GIT_BASELINE_REF,
  YAKABLE_GIT_EXCLUDES,
  initializeWorkspaceGitBaseline,
  readWorkspaceBaselineCommit,
  resetWorkspaceGitBaseline,
} from './git-baseline.js';
export type { WorkspaceGitBaseline } from './git-baseline.js';
export {
  TurnDiffTracker,
} from './turn-diff.js';
export type { WorkspaceTurnDiff } from './turn-diff.js';
export {
  readWorkspaceDiff,
} from './workspace-diff.js';
export type {
  WorkspaceDiffFile,
  WorkspaceDiffSnapshot,
} from './workspace-diff.js';
export {
  countUnifiedDiffStats,
  renderWorkspaceFileChangesDiff,
} from './unified-diff.js';
export type { UnifiedDiffStats } from './unified-diff.js';
