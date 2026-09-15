export const FRONTEND_AGENT_VERSION = 1 as const;

export const FRONTEND_AGENT_STATES = [
  'ROUTE',
  'UNDERSTAND',
  'DESIGN',
  'TEMPLATE',
  'GENERATE',
  'WRITE',
  'SELECT_CONTEXT',
  'READ',
  'EDIT',
  'CHECK',
  'RUNTIME',
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

export interface FrontendAgentRecorder {
  emit(
    state: FrontendAgentState,
    status: FrontendAgentStepStatus,
    message: string,
    iteration?: 0 | 1,
  ): FrontendAgentEvent;
  snapshot(): FrontendAgentEvent[];
}

export interface FrontendAgentProgressOptions {
  onEvent?: (event: FrontendAgentEvent) => void;
}

const START_STATES = new Set<FrontendAgentState>(['ROUTE', 'SELECT_CONTEXT']);

const NEXT_STATES: Record<FrontendAgentState, ReadonlySet<FrontendAgentState>> = {
  ROUTE: new Set(['UNDERSTAND']),
  UNDERSTAND: new Set(['DESIGN']),
  DESIGN: new Set(['TEMPLATE']),
  TEMPLATE: new Set(['GENERATE']),
  GENERATE: new Set(['WRITE']),
  WRITE: new Set(['CHECK', 'RUNTIME']),
  SELECT_CONTEXT: new Set(['READ']),
  READ: new Set(['EDIT']),
  EDIT: new Set(['CHECK']),
  CHECK: new Set(['REPAIR', 'RUNTIME', 'OBSERVE']),
  RUNTIME: new Set(['DONE']),
  OBSERVE: new Set(['CRITIQUE']),
  CRITIQUE: new Set(['REPAIR']),
  REPAIR: new Set(['CHECK', 'OBSERVE']),
  DONE: new Set(),
};

function normalizeMessage(message: string): string {
  const normalized = message.trim().replace(/\s+/g, ' ');
  if (!normalized) throw new Error('Frontend Agent event message is required.');
  return normalized.slice(0, 500);
}

export function createFrontendAgentEvent(
  state: FrontendAgentState,
  status: FrontendAgentStepStatus,
  message: string,
  iteration?: 0 | 1,
): FrontendAgentEvent {
  return {
    version: FRONTEND_AGENT_VERSION,
    state,
    status,
    message: normalizeMessage(message),
    at: new Date().toISOString(),
    ...(iteration === undefined ? {} : { iteration }),
  };
}

export function assertFrontendAgentTransition(
  previousState: FrontendAgentState | null,
  nextState: FrontendAgentState,
  repairCount = 0,
): void {
  if (previousState === null) {
    if (!START_STATES.has(nextState)) {
      throw new Error(
        `Frontend Agent must start at ROUTE or SELECT_CONTEXT, not ${nextState}.`,
      );
    }
    return;
  }

  if (previousState === nextState) return;
  if (previousState === 'DONE') {
    throw new Error('Frontend Agent cannot transition after DONE.');
  }
  if (nextState === 'DONE') return;
  if (!NEXT_STATES[previousState].has(nextState)) {
    throw new Error(`Invalid Frontend Agent transition: ${previousState} -> ${nextState}.`);
  }
  if (nextState === 'REPAIR' && repairCount >= 1) {
    throw new Error('Frontend Agent v0 allows at most one Repair state.');
  }
}

export function createFrontendAgentRecorder(
  options: FrontendAgentProgressOptions = {},
): FrontendAgentRecorder {
  const events: FrontendAgentEvent[] = [];
  let currentState: FrontendAgentState | null = null;
  let repairCount = 0;

  return {
    emit(state, status, message, iteration) {
      assertFrontendAgentTransition(currentState, state, repairCount);
      if (state !== currentState && state === 'REPAIR') repairCount += 1;
      currentState = state;

      const event = createFrontendAgentEvent(state, status, message, iteration);
      events.push(event);
      options.onEvent?.(event);
      return event;
    },

    snapshot() {
      return events.map((event) => ({ ...event }));
    },
  };
}

export async function runFrontendAgentStage<T>(
  recorder: FrontendAgentRecorder,
  state: Exclude<FrontendAgentState, 'DONE'>,
  activeMessage: string,
  completedMessage: string | ((result: T) => string),
  task: () => Promise<T>,
): Promise<T> {
  recorder.emit(state, 'ACTIVE', activeMessage);
  try {
    const result = await task();
    recorder.emit(
      state,
      'COMPLETED',
      typeof completedMessage === 'function' ? completedMessage(result) : completedMessage,
    );
    return result;
  } catch (error) {
    recorder.emit(
      state,
      'FAILED',
      `${activeMessage}: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}
