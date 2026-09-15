import {
  AGENT_PROGRESS_STATES,
  parseAgentProtocolItem,
  type AgentProgressItem,
  type AgentProgressState,
  type AgentProtocolItem,
  type AgentProtocolItemUpdateDetail,
} from '../../src/protocol/agent-protocol';

export const FRONTEND_AGENT_STATES = AGENT_PROGRESS_STATES;
export type FrontendAgentState = AgentProgressState;
export type FrontendAgentEvent = AgentProtocolItem;
export interface FrontendAgentProgressDetail extends AgentProtocolItemUpdateDetail {}

export const FRONTEND_AGENT_PROGRESS_EVENT = 'yakable:agent-protocol-item';

export function parseFrontendAgentEvent(value: unknown): AgentProtocolItem {
  return parseAgentProtocolItem(value);
}

export function createFrontendAgentEvent(
  state: AgentProgressState,
  status: AgentProgressItem['status'],
  message: string,
  iteration?: 0 | 1,
): AgentProgressItem {
  const timestamp = new Date().toISOString();
  return {
    version: 1,
    id: globalThis.crypto.randomUUID(),
    type: 'progress',
    state,
    status,
    startedAt: timestamp,
    ...(status === 'ACTIVE' ? {} : { completedAt: timestamp }),
    message: message.trim().replace(/\s+/g, ' ').slice(0, 1_000),
    ...(iteration === undefined ? {} : { iteration }),
  };
}

export function publishFrontendAgentEvent(runId: string, item: AgentProtocolItem): void {
  window.dispatchEvent(
    new CustomEvent<FrontendAgentProgressDetail>(FRONTEND_AGENT_PROGRESS_EVENT, {
      detail: { runId, item },
    }),
  );
}

export function subscribeFrontendAgentProgress(
  listener: (detail: FrontendAgentProgressDetail) => void,
): () => void {
  const handler = (event: Event) => {
    const custom = event as CustomEvent<FrontendAgentProgressDetail>;
    if (!custom.detail?.runId || !custom.detail.item) return;
    listener(custom.detail);
  };
  window.addEventListener(FRONTEND_AGENT_PROGRESS_EVENT, handler);
  return () => window.removeEventListener(FRONTEND_AGENT_PROGRESS_EVENT, handler);
}
