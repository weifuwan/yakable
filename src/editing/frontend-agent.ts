import {
  assertAgentProgressTransition,
  createAgentProtocolRecorder,
  runAgentStage,
  type AgentProtocolRecorder,
  type AgentProtocolRecorderOptions,
} from '../protocol/agent-recorder.js';
import {
  AGENT_PROGRESS_STATES,
  AGENT_PROTOCOL_VERSION,
  type AgentItemStatus,
  type AgentProgressItem,
  type AgentProgressState,
  type AgentProtocolItem,
} from '../protocol/agent-protocol.js';

export const FRONTEND_AGENT_VERSION = AGENT_PROTOCOL_VERSION;
export const FRONTEND_AGENT_STATES = AGENT_PROGRESS_STATES;

export type FrontendAgentState = AgentProgressState;
export type FrontendAgentStepStatus = AgentItemStatus;
export type FrontendAgentEvent = AgentProtocolItem;
export type FrontendAgentRecorder = AgentProtocolRecorder;
export interface FrontendAgentProgressOptions {
  onEvent?: (item: AgentProtocolItem) => void;
}

export function createFrontendAgentEvent(
  state: FrontendAgentState,
  status: FrontendAgentStepStatus,
  message: string,
  iteration?: 0 | 1,
): AgentProgressItem {
  const recorder = createAgentProtocolRecorder();
  return recorder.progress(state, status, message, iteration);
}

export function createFrontendAgentRecorder(
  options: FrontendAgentProgressOptions = {},
): FrontendAgentRecorder {
  const recorderOptions: AgentProtocolRecorderOptions = {
    ...(options.onEvent ? { onItem: options.onEvent } : {}),
  };
  return createAgentProtocolRecorder(recorderOptions);
}

export async function runFrontendAgentStage<T>(
  recorder: FrontendAgentRecorder,
  state: Exclude<FrontendAgentState, 'DONE'>,
  activeMessage: string,
  completedMessage: string | ((result: T) => string),
  task: () => Promise<T>,
): Promise<T> {
  return runAgentStage(recorder, state, activeMessage, completedMessage, task);
}

export function assertFrontendAgentTransition(
  previousState: FrontendAgentState | null,
  nextState: FrontendAgentState,
  repairCount = 0,
): void {
  assertAgentProgressTransition(previousState, nextState, repairCount);
}
