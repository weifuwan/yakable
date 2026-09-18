import {
  createAgentProtocolRecorder,
  type AgentProtocolRecorder,
} from '../protocol/agent-recorder.js';
import type { AgentProtocolItem } from '../protocol/agent-protocol.js';
import {
  listAgentRunItems,
  upsertAgentRunItem,
} from '../storage/agent-run-item.js';

export function createPersistedAgentRecorder(
  runId: string,
  onItem?: (item: AgentProtocolItem) => void,
): AgentProtocolRecorder {
  return createAgentProtocolRecorder({
    initialItems: listAgentRunItems(runId).map((record) => record.item),
    onItem(item) {
      upsertAgentRunItem(runId, item);
      onItem?.(item);
    },
  });
}
