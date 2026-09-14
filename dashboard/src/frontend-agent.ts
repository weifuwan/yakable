export const FRONTEND_AGENT_STATES = [
  'SELECT_CONTEXT',
  'READ',
  'EDIT',
  'CHECK',
  'OBSERVE',
  'CRITIQUE',
  'REPAIR',
  'DONE',
] as const;

export type FrontendAgentState = (typeof FRONTEND_AGENT_STATES)[number];
export type FrontendAgentStepStatus = 'ACTIVE' | 'COMPLETED' | 'SKIPPED' | 'FAILED';

export interface FrontendAgentEvent {
  version: 1;
  state: FrontendAgentState;
  status: FrontendAgentStepStatus;
  message: string;
  at: string;
  iteration?: 0 | 1;
}

export interface FrontendAgentProgressDetail {
  runId: string;
  event: FrontendAgentEvent;
}

export const FRONTEND_AGENT_PROGRESS_EVENT = 'yakable:frontend-agent-progress';

const STATES = new Set<FrontendAgentState>(FRONTEND_AGENT_STATES);
const STATUSES = new Set<FrontendAgentStepStatus>([
  'ACTIVE',
  'COMPLETED',
  'SKIPPED',
  'FAILED',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseFrontendAgentEvent(value: unknown): FrontendAgentEvent {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error('Frontend Agent stream returned an invalid event version.');
  }
  if (typeof value.state !== 'string' || !STATES.has(value.state as FrontendAgentState)) {
    throw new Error('Frontend Agent stream returned an invalid state.');
  }
  if (
    typeof value.status !== 'string'
    || !STATUSES.has(value.status as FrontendAgentStepStatus)
  ) {
    throw new Error('Frontend Agent stream returned an invalid step status.');
  }
  if (typeof value.message !== 'string' || !value.message.trim()) {
    throw new Error('Frontend Agent stream returned an invalid message.');
  }
  if (typeof value.at !== 'string' || !value.at.trim()) {
    throw new Error('Frontend Agent stream returned an invalid timestamp.');
  }
  if (value.iteration !== undefined && value.iteration !== 0 && value.iteration !== 1) {
    throw new Error('Frontend Agent stream returned an invalid iteration.');
  }

  return {
    version: 1,
    state: value.state as FrontendAgentState,
    status: value.status as FrontendAgentStepStatus,
    message: value.message.trim().slice(0, 500),
    at: value.at,
    ...(value.iteration === undefined ? {} : { iteration: value.iteration as 0 | 1 }),
  };
}

export function createFrontendAgentEvent(
  state: FrontendAgentState,
  status: FrontendAgentStepStatus,
  message: string,
  iteration?: 0 | 1,
): FrontendAgentEvent {
  return {
    version: 1,
    state,
    status,
    message: message.trim().replace(/\s+/g, ' ').slice(0, 500),
    at: new Date().toISOString(),
    ...(iteration === undefined ? {} : { iteration }),
  };
}

export function publishFrontendAgentEvent(runId: string, event: FrontendAgentEvent): void {
  window.dispatchEvent(
    new CustomEvent<FrontendAgentProgressDetail>(FRONTEND_AGENT_PROGRESS_EVENT, {
      detail: { runId, event },
    }),
  );
}

export function subscribeFrontendAgentProgress(
  listener: (detail: FrontendAgentProgressDetail) => void,
): () => void {
  const handler = (event: Event) => {
    const custom = event as CustomEvent<FrontendAgentProgressDetail>;
    if (!custom.detail?.runId || !custom.detail.event) return;
    listener(custom.detail);
  };
  window.addEventListener(FRONTEND_AGENT_PROGRESS_EVENT, handler);
  return () => window.removeEventListener(FRONTEND_AGENT_PROGRESS_EVENT, handler);
}
