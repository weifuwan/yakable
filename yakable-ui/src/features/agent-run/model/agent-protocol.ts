export const AGENT_PROTOCOL_VERSION = 1 as const;

export const AGENT_PROGRESS_STATES = [
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

export type AgentProgressState = (typeof AGENT_PROGRESS_STATES)[number];
export type AgentItemStatus = 'ACTIVE' | 'COMPLETED' | 'SKIPPED' | 'FAILED';
export type AgentItemType =
  | 'progress'
  | 'tool_call'
  | 'file_change'
  | 'command_execution'
  | 'check_result'
  | 'agent_message';

export interface AgentItemBase {
  version: 1;
  id: string;
  type: AgentItemType;
  status: AgentItemStatus;
  startedAt: string;
  completedAt?: string;
  message: string;
}

export interface AgentProgressItem extends AgentItemBase {
  type: 'progress';
  state: AgentProgressState;
  iteration?: 0 | 1;
}

export interface AgentToolCallItem extends AgentItemBase {
  type: 'tool_call';
  toolName: string;
  inputSummary?: string;
  outputSummary?: string;
}

export interface AgentFileChangeEntry {
  path: string;
  changeType: 'ADDED' | 'MODIFIED' | 'DELETED';
}

export interface AgentFileChangeItem extends AgentItemBase {
  type: 'file_change';
  changeSetId: string;
  summary: string;
  files: AgentFileChangeEntry[];
}

export interface AgentCommandExecutionItem extends AgentItemBase {
  type: 'command_execution';
  command: string;
  phase?: string;
  exitCode?: number | null;
  timedOut?: boolean;
  outputTruncated?: boolean;
}

export interface AgentCheckResultItem extends AgentItemBase {
  type: 'check_result';
  result: 'PASS' | 'FAIL' | 'ERROR';
  checks: Array<{
    phase: string;
    status: 'PASS' | 'FAIL';
    exitCode: number | null;
    timedOut: boolean;
    outputTruncated: boolean;
  }>;
  diagnosticCount: number;
}

export interface AgentMessageItem extends AgentItemBase {
  type: 'agent_message';
  role: 'assistant';
  content: string;
}

export type AgentProtocolItem =
  | AgentProgressItem
  | AgentToolCallItem
  | AgentFileChangeItem
  | AgentCommandExecutionItem
  | AgentCheckResultItem
  | AgentMessageItem;

export interface AgentProtocolItemUpdateDetail {
  runId: string;
  item: AgentProtocolItem;
}

const ITEM_TYPES = new Set<AgentItemType>([
  'progress',
  'tool_call',
  'file_change',
  'command_execution',
  'check_result',
  'agent_message',
]);
const STATUSES = new Set<AgentItemStatus>(['ACTIVE', 'COMPLETED', 'SKIPPED', 'FAILED']);
const PROGRESS_STATES = new Set<AgentProgressState>(AGENT_PROGRESS_STATES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, label: string, max = 1_000): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim().slice(0, max);
}

export function parseAgentProtocolItem(value: unknown): AgentProtocolItem {
  if (!isRecord(value) || value.version !== AGENT_PROTOCOL_VERSION) {
    throw new Error('Agent protocol item has an invalid version.');
  }
  if (typeof value.type !== 'string' || !ITEM_TYPES.has(value.type as AgentItemType)) {
    throw new Error('Agent protocol item has an invalid type.');
  }
  if (typeof value.status !== 'string' || !STATUSES.has(value.status as AgentItemStatus)) {
    throw new Error('Agent protocol item has an invalid status.');
  }

  const base = {
    version: AGENT_PROTOCOL_VERSION,
    id: requiredString(value.id, 'Agent item id', 160),
    type: value.type as AgentItemType,
    status: value.status as AgentItemStatus,
    startedAt: requiredString(value.startedAt, 'Agent item startedAt', 80),
    ...(typeof value.completedAt === 'string' && value.completedAt.trim()
      ? { completedAt: value.completedAt.trim().slice(0, 80) }
      : {}),
    message: requiredString(value.message, 'Agent item message', 1_000),
  };

  if (base.type === 'progress') {
    if (typeof value.state !== 'string' || !PROGRESS_STATES.has(value.state as AgentProgressState)) {
      throw new Error('Agent progress item has an invalid state.');
    }
    if (value.iteration !== undefined && value.iteration !== 0 && value.iteration !== 1) {
      throw new Error('Agent progress item has an invalid iteration.');
    }
    return {
      ...base,
      type: 'progress',
      state: value.state as AgentProgressState,
      ...(value.iteration === undefined ? {} : { iteration: value.iteration as 0 | 1 }),
    };
  }

  if (base.type === 'tool_call') {
    return {
      ...base,
      type: 'tool_call',
      toolName: requiredString(value.toolName, 'Agent tool name', 120),
      ...(typeof value.inputSummary === 'string' && value.inputSummary.trim()
        ? { inputSummary: value.inputSummary.trim().slice(0, 1_000) }
        : {}),
      ...(typeof value.outputSummary === 'string' && value.outputSummary.trim()
        ? { outputSummary: value.outputSummary.trim().slice(0, 1_000) }
        : {}),
    };
  }

  if (base.type === 'file_change') {
    if (!Array.isArray(value.files)) throw new Error('Agent file change item requires files.');
    const files = value.files.map((entry, index) => {
      if (!isRecord(entry)) throw new Error(`Agent file change files[${index}] is invalid.`);
      const changeType = entry.changeType;
      if (changeType !== 'ADDED' && changeType !== 'MODIFIED' && changeType !== 'DELETED') {
        throw new Error(`Agent file change files[${index}] has an invalid change type.`);
      }
      return {
        path: requiredString(entry.path, `Agent file change files[${index}].path`, 240),
        changeType,
      };
    });
    return {
      ...base,
      type: 'file_change',
      changeSetId: requiredString(value.changeSetId, 'Agent change set id', 160),
      summary: requiredString(value.summary, 'Agent file change summary', 1_000),
      files,
    };
  }

  if (base.type === 'command_execution') {
    return {
      ...base,
      type: 'command_execution',
      command: requiredString(value.command, 'Agent command', 1_000),
      ...(typeof value.phase === 'string' && value.phase.trim()
        ? { phase: value.phase.trim().slice(0, 120) }
        : {}),
      ...(value.exitCode === null || typeof value.exitCode === 'number'
        ? { exitCode: value.exitCode as number | null }
        : {}),
      ...(typeof value.timedOut === 'boolean' ? { timedOut: value.timedOut } : {}),
      ...(typeof value.outputTruncated === 'boolean'
        ? { outputTruncated: value.outputTruncated }
        : {}),
    };
  }

  if (base.type === 'check_result') {
    if (value.result !== 'PASS' && value.result !== 'FAIL' && value.result !== 'ERROR') {
      throw new Error('Agent check result item has an invalid result.');
    }
    if (!Array.isArray(value.checks)) throw new Error('Agent check result item requires checks.');
    return {
      ...base,
      type: 'check_result',
      result: value.result,
      checks: value.checks.map((check, index) => {
        if (!isRecord(check)) throw new Error(`Agent check checks[${index}] is invalid.`);
        if (check.status !== 'PASS' && check.status !== 'FAIL') {
          throw new Error(`Agent check checks[${index}] has an invalid status.`);
        }
        return {
          phase: requiredString(check.phase, `Agent check checks[${index}].phase`, 120),
          status: check.status,
          exitCode: check.exitCode === null || typeof check.exitCode === 'number'
            ? check.exitCode as number | null
            : null,
          timedOut: check.timedOut === true,
          outputTruncated: check.outputTruncated === true,
        };
      }),
      diagnosticCount: typeof value.diagnosticCount === 'number' && value.diagnosticCount >= 0
        ? Math.floor(value.diagnosticCount)
        : 0,
    };
  }

  return {
    ...base,
    type: 'agent_message',
    role: 'assistant',
    content: requiredString(value.content, 'Agent message content', 8_000),
  };
}
