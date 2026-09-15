import {
  recordAgentRunFileChanges,
  type AgentRunFileChangeRecord,
} from './agent-run.js';
import type { WorkspaceChangeSet } from '../workspace/change-set.js';

/**
 * Persist the runtime ChangeSet into the existing agent diff storage.
 *
 * Storage remains flattened per file for the current UI, while mutation code
 * now deals exclusively in WorkspaceChangeSet values.
 */
export function recordAgentRunChangeSet(
  runId: string,
  changeSet: WorkspaceChangeSet,
): AgentRunFileChangeRecord[] {
  return recordAgentRunFileChanges(
    runId,
    changeSet.files.map((file) => ({
      path: file.path,
      beforeContent: file.beforeContent,
      afterContent: file.afterContent,
    })),
  );
}
