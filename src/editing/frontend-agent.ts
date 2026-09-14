export const FRONTEND_AGENT_VERSION = 1 as const;

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

const NEXT_STATES: Record<FrontendAgentState, ReadonlySet<FrontendAgentState>> = {
  SELECT_CONTEXT: new Set(['READ']),
  READ: new Set(['EDIT']),
  EDIT: new Set(['CHECK']),
  CHECK: new Set(['OBSERVE']),
  OBSERVE: new Set(['CRITIQUE']),
  CRITIQUE: new Set(['REPAIR']),
  REPAIR: new Set(['OBSERVE']),
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
    if (nextState !== 'SELECT_CONTEXT') {
      throw new Error(`Frontend Agent must start at SELECT_CONTEXT, not ${nextState}.`);
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
    throw new Error('Frontend Agent v0 allows at most one Visual Repair state.');
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
  completedMessage: string,
  task: () => Promise<T>,
): Promise<T> {
  recorder.emit(state, 'ACTIVE', activeMessage);
  try {
    const result = await task();
    recorder.emit(state, 'COMPLETED', completedMessage);
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
