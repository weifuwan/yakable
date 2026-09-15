import {
  parseAgentProtocolItem,
  type AgentProtocolItem,
} from '../../src/protocol/agent-protocol';
import type { RuntimeProject } from './api';
import { publishFrontendAgentEvent } from './frontend-agent';

export type BuildIntentRoute = 'CREATE' | 'CHAT' | 'CLARIFY';
export type BuildIntentConfidence = 'high' | 'medium';

export interface BuildIntentDecision {
  version: 1;
  route: BuildIntentRoute;
  confidence: BuildIntentConfidence;
  message: string;
}

export type ProjectLifecycleStatus =
  | 'CREATING'
  | 'GENERATING'
  | 'STARTING_RUNTIME'
  | 'READY'
  | 'FAILED';

export type AgentRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface ProjectCreationProject {
  id: string;
  name: string;
  prompt: string;
  status: ProjectLifecycleStatus;
  activeRunId?: string;
  failureMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCreationRun {
  id: string;
  status: AgentRunStatus;
  model?: string;
  summary?: string;
  startedAt: string;
  completedAt?: string;
  items?: AgentProtocolItem[];
}

export interface ProjectCreationStatus {
  project: ProjectCreationProject;
  run: ProjectCreationRun | null;
}

export interface ProjectBootstrapResult {
  decision: BuildIntentDecision;
  project: {
    id: string;
    name: string;
  };
  creation: ProjectCreationStatus | null;
}

export interface ProjectRetryResult {
  retryOf: string;
  decision: BuildIntentDecision;
  project: ProjectCreationProject;
  run: ProjectCreationRun;
}

export type ProjectCreationStreamRecord =
  | { type: 'snapshot'; status: ProjectCreationStatus }
  | { type: 'agent-item'; runId: string; item: AgentProtocolItem }
  | { type: 'ready'; runtime: RuntimeProject }
  | { type: 'failed'; error: string };

export interface WatchProjectCreationOptions {
  initialStatus: ProjectCreationStatus;
  signal?: AbortSignal;
  onStatus?: (status: ProjectCreationStatus) => void;
}

function errorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === 'object'
    && payload !== null
    && 'error' in payload
    && typeof (payload as { error?: unknown }).error === 'string'
  ) {
    return (payload as { error: string }).error;
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCreationStreamRecord(line: string): ProjectCreationStreamRecord {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error('Project creation stream returned invalid JSON.');
  }
  if (!isRecord(value) || typeof value.type !== 'string') {
    throw new Error('Project creation stream returned an invalid record.');
  }

  if (value.type === 'snapshot' && isRecord(value.status)) {
    return { type: 'snapshot', status: value.status as unknown as ProjectCreationStatus };
  }
  if (value.type === 'agent-item' && typeof value.runId === 'string') {
    return {
      type: 'agent-item',
      runId: value.runId,
      item: parseAgentProtocolItem(value.item),
    };
  }
  if (value.type === 'ready' && isRecord(value.runtime)) {
    return { type: 'ready', runtime: value.runtime as unknown as RuntimeProject };
  }
  if (value.type === 'failed' && typeof value.error === 'string') {
    return { type: 'failed', error: value.error };
  }
  throw new Error('Project creation stream returned an unknown record type.');
}

export function mergeCreationAgentItem(
  status: ProjectCreationStatus,
  runId: string,
  item: AgentProtocolItem,
): ProjectCreationStatus {
  if (!status.run || status.run.id !== runId) return status;

  const items = [...(status.run.items ?? [])];
  const existingIndex = items.findIndex((current) => current.id === item.id);
  if (existingIndex === -1) items.push(item);
  else items[existingIndex] = item;

  const done = item.type === 'progress' && item.state === 'DONE' && item.status !== 'ACTIVE';
  const nextRun: ProjectCreationRun = {
    ...status.run,
    items,
    ...(done
      ? {
          status: item.status === 'FAILED' ? 'FAILED' : 'COMPLETED',
          ...(item.completedAt ? { completedAt: item.completedAt } : {}),
        }
      : {}),
  };

  return { ...status, run: nextRun };
}

async function consumeCreationStream(
  response: Response,
  options: WatchProjectCreationOptions,
): Promise<RuntimeProject | null> {
  if (!response.body) {
    throw new Error('Project creation stream is not available in this browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let current = options.initialStatus;
  let ready: RuntimeProject | null = null;

  const consumeLine = (line: string) => {
    const record = parseCreationStreamRecord(line);
    if (record.type === 'snapshot') {
      current = record.status;
      options.onStatus?.(current);
      return;
    }
    if (record.type === 'agent-item') {
      current = mergeCreationAgentItem(current, record.runId, record.item);
      options.onStatus?.(current);
      publishFrontendAgentEvent(record.runId, record.item);
      return;
    }
    if (record.type === 'ready') {
      ready = record.runtime;
      return;
    }
    throw new Error(record.error);
  };

  while (true) {
    const chunk = await reader.read();
    buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (line.trim()) consumeLine(line);
      newline = buffer.indexOf('\n');
    }
    if (chunk.done) break;
  }
  if (buffer.trim()) consumeLine(buffer);
  return ready;
}

export async function bootstrapProject(prompt: string): Promise<ProjectBootstrapResult> {
  const response = await fetch('/api/projects/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(errorMessage(payload, `Yakable API failed with HTTP ${response.status}.`));
  }
  return payload as ProjectBootstrapResult;
}

export async function retryProjectCreation(projectId: string): Promise<ProjectRetryResult> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/creation/retry`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(errorMessage(payload, `Yakable API failed with HTTP ${response.status}.`));
  }
  return payload as ProjectRetryResult;
}

export async function readProjectCreationStatus(
  projectId: string,
): Promise<ProjectCreationStatus | null> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/creation`,
    { headers: { Accept: 'application/json' } },
  );
  if (response.status === 404) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(errorMessage(payload, `Yakable API failed with HTTP ${response.status}.`));
  }
  return payload as ProjectCreationStatus;
}

export async function watchProjectCreation(
  projectId: string,
  options: WatchProjectCreationOptions,
): Promise<RuntimeProject | null> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/creation/stream`,
    {
      headers: { Accept: 'application/x-ndjson' },
      signal: options.signal,
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(errorMessage(payload, `Yakable API failed with HTTP ${response.status}.`));
  }
  return consumeCreationStream(response, options);
}
