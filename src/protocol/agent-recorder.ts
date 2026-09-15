import {
  AGENT_PROTOCOL_VERSION,
  type AgentCheckResultItem,
  type AgentCommandExecutionItem,
  type AgentFileChangeItem,
  type AgentItemStatus,
  type AgentMessageItem,
  type AgentProgressItem,
  type AgentProgressState,
  type AgentProtocolItem,
  type AgentToolCallItem,
} from './agent-protocol.js';

export interface AgentProtocolRecorderOptions {
  onItem?: (item: AgentProtocolItem) => void;
  initialItems?: AgentProtocolItem[];
  now?: () => Date;
  idFactory?: () => string;
}

export interface AgentProtocolRecorder {
  progress(
    state: AgentProgressState,
    status: AgentItemStatus,
    message: string,
    iteration?: 0 | 1,
  ): AgentProgressItem;
  emit(
    state: AgentProgressState,
    status: AgentItemStatus,
    message: string,
    iteration?: 0 | 1,
  ): AgentProgressItem;
  startToolCall(toolName: string, message: string, inputSummary?: string): AgentToolCallItem;
  completeToolCall(
    itemId: string,
    status: Exclude<AgentItemStatus, 'ACTIVE'>,
    message: string,
    outputSummary?: string,
  ): AgentToolCallItem;
  fileChange(input: {
    changeSetId: string;
    summary: string;
    files: AgentFileChangeItem['files'];
    message?: string;
  }): AgentFileChangeItem;
  commandExecution(input: {
    command: string;
    phase?: string;
    status: Exclude<AgentItemStatus, 'ACTIVE'>;
    message: string;
    exitCode?: number | null;
    timedOut?: boolean;
    outputTruncated?: boolean;
  }): AgentCommandExecutionItem;
  checkResult(input: {
    result: AgentCheckResultItem['result'];
    checks: AgentCheckResultItem['checks'];
    diagnosticCount: number;
    message: string;
  }): AgentCheckResultItem;
  message(content: string): AgentMessageItem;
  snapshot(): AgentProtocolItem[];
}

const START_STATES = new Set<AgentProgressState>(['ROUTE', 'SELECT_CONTEXT']);
const NEXT_STATES: Record<AgentProgressState, ReadonlySet<AgentProgressState>> = {
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

function normalized(value: string, label: string, max = 1_000): string {
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text) throw new Error(`${label} is required.`);
  return text.slice(0, max);
}

let fallbackId = 0;
function defaultIdFactory(): string {
  const cryptoValue = globalThis.crypto?.randomUUID?.();
  if (cryptoValue) return cryptoValue;
  fallbackId += 1;
  return `agent-item-${Date.now()}-${fallbackId}`;
}

export function assertAgentProgressTransition(
  previousState: AgentProgressState | null,
  nextState: AgentProgressState,
  repairCount = 0,
): void {
  if (previousState === null) {
    if (!START_STATES.has(nextState)) {
      throw new Error(`Agent progress must start at ROUTE or SELECT_CONTEXT, not ${nextState}.`);
    }
    return;
  }
  if (previousState === nextState) return;
  if (previousState === 'DONE') throw new Error('Agent progress cannot transition after DONE.');
  if (nextState === 'DONE') return;
  if (!NEXT_STATES[previousState].has(nextState)) {
    throw new Error(`Invalid agent progress transition: ${previousState} -> ${nextState}.`);
  }
  if (nextState === 'REPAIR' && repairCount >= 1) {
    throw new Error('Agent runtime allows at most one Repair state per bounded run.');
  }
}

export function createAgentProtocolRecorder(
  options: AgentProtocolRecorderOptions = {},
): AgentProtocolRecorder {
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? defaultIdFactory;
  const items = new Map<string, AgentProtocolItem>();
  const order: string[] = [];

  for (const item of options.initialItems ?? []) {
    items.set(item.id, { ...item });
    order.push(item.id);
  }

  let currentState: AgentProgressState | null = null;
  let repairCount = 0;
  for (const item of options.initialItems ?? []) {
    if (item.type !== 'progress') continue;
    currentState = item.state;
    if (item.state === 'REPAIR') repairCount += 1;
  }

  const publish = <T extends AgentProtocolItem>(item: T): T => {
    if (!items.has(item.id)) order.push(item.id);
    items.set(item.id, item);
    options.onItem?.({ ...item });
    return item;
  };

  const activeProgress = (state: AgentProgressState): AgentProgressItem | null => {
    for (let index = order.length - 1; index >= 0; index -= 1) {
      const item = items.get(order[index]!);
      if (item?.type === 'progress' && item.state === state && item.status === 'ACTIVE') return item;
    }
    return null;
  };

  const progress = (
    state: AgentProgressState,
    status: AgentItemStatus,
    message: string,
    iteration?: 0 | 1,
  ): AgentProgressItem => {
    const timestamp = now().toISOString();
    if (status === 'ACTIVE') {
      assertAgentProgressTransition(currentState, state, repairCount);
      if (state !== currentState && state === 'REPAIR') repairCount += 1;
      currentState = state;
      return publish({
        version: AGENT_PROTOCOL_VERSION,
        id: idFactory(),
        type: 'progress',
        status,
        state,
        startedAt: timestamp,
        message: normalized(message, 'Agent progress message'),
        ...(iteration === undefined ? {} : { iteration }),
      });
    }

    const active = activeProgress(state);
    if (active) {
      if (state !== currentState) {
        assertAgentProgressTransition(currentState, state, repairCount);
        currentState = state;
      }
      return publish({
        ...active,
        status,
        completedAt: timestamp,
        message: normalized(message, 'Agent progress message'),
        ...(iteration === undefined ? {} : { iteration }),
      });
    }

    assertAgentProgressTransition(currentState, state, repairCount);
    if (state !== currentState && state === 'REPAIR') repairCount += 1;
    currentState = state;
    return publish({
      version: AGENT_PROTOCOL_VERSION,
      id: idFactory(),
      type: 'progress',
      status,
      state,
      startedAt: timestamp,
      completedAt: timestamp,
      message: normalized(message, 'Agent progress message'),
      ...(iteration === undefined ? {} : { iteration }),
    });
  };

  return {
    progress,
    emit: progress,

    startToolCall(toolName, message, inputSummary) {
      return publish({
        version: AGENT_PROTOCOL_VERSION,
        id: idFactory(),
        type: 'tool_call',
        status: 'ACTIVE',
        startedAt: now().toISOString(),
        message: normalized(message, 'Agent tool call message'),
        toolName: normalized(toolName, 'Agent tool name', 120),
        ...(inputSummary ? { inputSummary: inputSummary.trim().slice(0, 1_000) } : {}),
      });
    },

    completeToolCall(itemId, status, message, outputSummary) {
      const existing = items.get(itemId);
      if (!existing || existing.type !== 'tool_call') {
        throw new Error(`Agent tool call item does not exist: ${itemId}`);
      }
      return publish({
        ...existing,
        status,
        completedAt: now().toISOString(),
        message: normalized(message, 'Agent tool call message'),
        ...(outputSummary ? { outputSummary: outputSummary.trim().slice(0, 1_000) } : {}),
      });
    },

    fileChange(input) {
      const timestamp = now().toISOString();
      return publish({
        version: AGENT_PROTOCOL_VERSION,
        id: idFactory(),
        type: 'file_change',
        status: 'COMPLETED',
        startedAt: timestamp,
        completedAt: timestamp,
        message: normalized(
          input.message ?? `${input.files.length} file change(s): ${input.summary}`,
          'Agent file change message',
        ),
        changeSetId: normalized(input.changeSetId, 'Agent change set id', 160),
        summary: normalized(input.summary, 'Agent file change summary'),
        files: input.files.map((file) => ({ ...file })),
      });
    },

    commandExecution(input) {
      const timestamp = now().toISOString();
      return publish({
        version: AGENT_PROTOCOL_VERSION,
        id: idFactory(),
        type: 'command_execution',
        status: input.status,
        startedAt: timestamp,
        completedAt: timestamp,
        message: normalized(input.message, 'Agent command message'),
        command: normalized(input.command, 'Agent command', 1_000),
        ...(input.phase ? { phase: input.phase.trim().slice(0, 120) } : {}),
        ...(input.exitCode === undefined ? {} : { exitCode: input.exitCode }),
        ...(input.timedOut === undefined ? {} : { timedOut: input.timedOut }),
        ...(input.outputTruncated === undefined
          ? {}
          : { outputTruncated: input.outputTruncated }),
      });
    },

    checkResult(input) {
      const timestamp = now().toISOString();
      return publish({
        version: AGENT_PROTOCOL_VERSION,
        id: idFactory(),
        type: 'check_result',
        status: input.result === 'PASS' ? 'COMPLETED' : 'FAILED',
        startedAt: timestamp,
        completedAt: timestamp,
        message: normalized(input.message, 'Agent check result message'),
        result: input.result,
        checks: input.checks.map((check) => ({ ...check })),
        diagnosticCount: Math.max(0, Math.floor(input.diagnosticCount)),
      });
    },

    message(content) {
      const timestamp = now().toISOString();
      const normalizedContent = content.trim().slice(0, 8_000);
      if (!normalizedContent) throw new Error('Agent message content is required.');
      return publish({
        version: AGENT_PROTOCOL_VERSION,
        id: idFactory(),
        type: 'agent_message',
        status: 'COMPLETED',
        startedAt: timestamp,
        completedAt: timestamp,
        message: normalizedContent.slice(0, 1_000),
        role: 'assistant',
        content: normalizedContent,
      });
    },

    snapshot() {
      return order.map((id) => ({ ...items.get(id)! }));
    },
  };
}

export async function runAgentStage<T>(
  recorder: AgentProtocolRecorder,
  state: Exclude<AgentProgressState, 'DONE'>,
  activeMessage: string,
  completedMessage: string | ((result: T) => string),
  task: () => Promise<T>,
): Promise<T> {
  recorder.progress(state, 'ACTIVE', activeMessage);
  try {
    const result = await task();
    recorder.progress(
      state,
      'COMPLETED',
      typeof completedMessage === 'function' ? completedMessage(result) : completedMessage,
    );
    return result;
  } catch (error) {
    recorder.progress(
      state,
      'FAILED',
      `${activeMessage}: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}
