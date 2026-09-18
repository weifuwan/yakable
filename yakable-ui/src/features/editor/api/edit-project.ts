import {
  parseFrontendAgentEvent,
  publishFrontendAgentEvent,
} from '@/features/agent-run/model/frontend-agent';
import { cancelAgentRun } from '@/features/agent-run/api/cancel-agent-run';
import {
  requestPreviewPageObservation,
  type PreviewPageObservation,
} from '@/features/preview/model/preview-page-observation';
import {
  buildVisualEditPrompt,
  clearCurrentPreviewSelections,
  getCurrentPreviewSelections,
  type PreviewSelection,
} from '@/features/preview/model/visual-edit-context';
import {
  routeProjectMessage,
  startProjectRuntime,
} from '@/features/project/api/projects';
import type {
  ProjectConversation,
  ProjectMessageRoutingResult,
  RuntimeProject,
} from '@/features/project/model/types';
import { consumeNdjson, parseRecord } from '@/shared/api/stream';
import {
  abortError,
  abortable,
  delay,
  isAbortLike,
  throwIfAborted,
} from '@/shared/lib/abort';
import type {
  EditActivitySnapshot,
  EditActivityStatus,
  EditedProject,
  EditProjectOptions,
  ProjectMessageResult,
} from '../model/types';

type AgentEditStreamRecord =
  | { type: 'run-started'; runId: string }
  | { type: 'agent-item'; item: unknown }
  | { type: 'await-client-tool'; result: EditedProject }
  | { type: 'result'; result: EditedProject }
  | { type: 'error'; error: string };

const PREVIEW_RELOAD_TIMEOUT_MS = 8_000;
const STOPPING_FEEDBACK_MIN_MS = 220;
const editActivityListeners = new Set<() => void>();
let editActivitySnapshot: EditActivitySnapshot = { status: 'idle', runId: null };
let managedEditController: AbortController | null = null;
let managedEditRunId: string | null = null;
let managedStopPromise: Promise<void> | null = null;
let managedStopStartedAt = 0;

export function subscribeEditActivity(listener: () => void): () => void {
  editActivityListeners.add(listener);
  return () => editActivityListeners.delete(listener);
}

export function getEditActivitySnapshot(): EditActivitySnapshot {
  return editActivitySnapshot;
}

function publishEditActivity(status: EditActivityStatus, runId = managedEditRunId): void {
  const next: EditActivitySnapshot = { status, runId };
  if (
    editActivitySnapshot.status === next.status
    && editActivitySnapshot.runId === next.runId
  ) {
    return;
  }
  editActivitySnapshot = next;
  for (const listener of editActivityListeners) listener();
}

function parseAgentEditStreamRecord(line: string): AgentEditStreamRecord {
  const record = parseRecord(line);
  if (record.type === 'run-started' && typeof record.runId === 'string') {
    return { type: 'run-started', runId: record.runId };
  }
  if (record.type === 'agent-item') return { type: 'agent-item', item: record.item };
  if (
    (record.type === 'await-client-tool' || record.type === 'result')
    && record.result
    && typeof record.result === 'object'
  ) {
    return { type: record.type, result: record.result as EditedProject };
  }
  if (record.type === 'error' && typeof record.error === 'string') {
    return { type: 'error', error: record.error };
  }
  throw new Error('Edit Agent stream returned an unknown record type.');
}

async function requestAgentEdit(
  projectId: string,
  prompt: string,
  options: EditProjectOptions,
): Promise<EditedProject> {
  let runId = '';
  let result: EditedProject | null = null;
  const rememberRunId = (nextRunId: string) => {
    if (!nextRunId || nextRunId === runId) return;
    runId = nextRunId;
    options.onRunStarted?.(nextRunId);
  };

  throwIfAborted(options.signal);
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/agent-edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
    signal: options.signal,
  });
  return consumeNdjson(
    response,
    (line) => {
      const record = parseAgentEditStreamRecord(line);
      if (record.type === 'run-started') {
        rememberRunId(record.runId);
      } else if (record.type === 'agent-item') {
        if (!runId) throw new Error('Agent item arrived before the server run id.');
        publishFrontendAgentEvent(runId, parseFrontendAgentEvent(record.item));
      } else if (record.type === 'error') {
        throw new Error(record.error);
      } else {
        result = record.result;
        rememberRunId(record.result.runId);
      }
    },
    () => result,
    options.signal,
  );
}

async function continueAgentEdit(
  runId: string,
  toolResult: {
    toolCallId: string;
    toolName: 'observe_preview';
    status: 'COMPLETED' | 'FAILED';
    output?: PreviewPageObservation;
    error?: string;
  },
  signal?: AbortSignal,
): Promise<EditedProject> {
  let result: EditedProject | null = null;
  throwIfAborted(signal);
  const response = await fetch(`/api/agent-runs/${encodeURIComponent(runId)}/client-tool-result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toolResult),
    signal,
  });
  return consumeNdjson(
    response,
    (line) => {
      const record = parseAgentEditStreamRecord(line);
      if (record.type === 'agent-item') {
        publishFrontendAgentEvent(runId, parseFrontendAgentEvent(record.item));
      } else if (record.type === 'error') {
        throw new Error(record.error);
      } else if (record.type === 'await-client-tool' || record.type === 'result') {
        result = record.result;
      }
    },
    () => result,
    signal,
  );
}



export async function stopActiveEdit(): Promise<void> {
  const controller = managedEditController;
  if (!controller || controller.signal.aborted || editActivitySnapshot.status === 'stopping') return;

  managedStopStartedAt = performance.now();
  publishEditActivity('stopping');
  const runId = managedEditRunId;
  managedStopPromise = runId
    ? cancelAgentRun(runId).catch((error) => {
        console.warn('[Yakable] Could not persist the stopped Agent run.', error);
      })
    : Promise.resolve();

  const reason = new Error('Stopped by user.');
  reason.name = 'AbortError';
  controller.abort(reason);
  await managedStopPromise;
}

function currentPreviewFrame(): HTMLIFrameElement | null {
  return document.querySelector<HTMLIFrameElement>('iframe[title$=" preview"]');
}

function preservePreviewRoute(runtimeUrl: string, frame: HTMLIFrameElement): string {
  const next = new URL(runtimeUrl, window.location.origin);
  const current = new URL(frame.src || runtimeUrl, window.location.origin);
  next.pathname = current.pathname || '/';
  for (const [key, value] of current.searchParams) {
    if (key === 'revision' || next.searchParams.has(key)) continue;
    next.searchParams.set(key, value);
  }
  next.hash = current.hash;
  return next.toString();
}

function reloadPreviewFrame(
  frame: HTMLIFrameElement,
  runtimeUrl: string,
  timeoutMs = PREVIEW_RELOAD_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<void> {
  throwIfAborted(signal);
  const nextUrl = preservePreviewRoute(runtimeUrl, frame);
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      frame.removeEventListener('load', onLoad);
      signal?.removeEventListener('abort', onAbort);
      window.clearTimeout(timeout);
    };
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const onLoad = () => settle(resolve);
    const onAbort = () => settle(() => reject(abortError(signal)));
    const timeout = window.setTimeout(() => {
      settle(() => reject(new Error('Preview reload timed out before observation.')));
    }, timeoutMs);
    frame.addEventListener('load', onLoad);
    signal?.addEventListener('abort', onAbort, { once: true });
    frame.src = nextUrl;
  });
}

async function executeClientTool(
  step: EditedProject,
  signal?: AbortSignal,
): Promise<{
  toolCallId: string;
  toolName: 'observe_preview';
  status: 'COMPLETED' | 'FAILED';
  output?: PreviewPageObservation;
  error?: string;
}> {
  throwIfAborted(signal);
  const request = step.clientTool;
  if (!request || request.toolName !== 'observe_preview') {
    throw new Error('Server requested an unsupported client tool.');
  }

  const frame = currentPreviewFrame();
  if (!frame) {
    return {
      toolCallId: request.toolCallId,
      toolName: 'observe_preview',
      status: 'FAILED',
      error: 'Active Preview frame was not found.',
    };
  }

  try {
    await reloadPreviewFrame(frame, step.previewUrl, PREVIEW_RELOAD_TIMEOUT_MS, signal);
    throwIfAborted(signal);
    const observation = await abortable(requestPreviewPageObservation(frame), signal);
    throwIfAborted(signal);
    return {
      toolCallId: request.toolCallId,
      toolName: 'observe_preview',
      status: 'COMPLETED',
      output: observation,
    };
  } catch (error) {
    if (signal?.aborted) throw abortError(signal);
    return {
      toolCallId: request.toolCallId,
      toolName: 'observe_preview',
      status: 'FAILED',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function stoppedConversation(
  runtime: RuntimeProject,
  prompt: string,
): ProjectConversation {
  const now = new Date().toISOString();
  const current = runtime.conversation;
  const existing = current?.messages ?? [];
  const last = existing.at(-1);
  const messages = last?.role === 'user' && last.content === prompt
    ? existing
    : [
        ...existing,
        {
          id: `stopped-user-${Date.now()}`,
          role: 'user' as const,
          content: prompt,
          createdAt: now,
        },
      ];
  return current
    ? { ...current, updatedAt: now, messages }
    : { projectId: runtime.projectId, createdAt: now, updatedAt: now, messages };
}

async function stoppedEditResult(
  projectId: string,
  prompt: string,
  runId: string | null,
): Promise<ProjectMessageResult> {
  const runtime = await startProjectRuntime(projectId);
  return {
    ...runtime,
    conversation: stoppedConversation(runtime, prompt),
    runId: runId ?? '',
    status: 'FAILED',
    userRequest: prompt,
    route: 'EDIT',
    summary: 'Stopped by user.',
    model: 'cancelled',
    changedFiles: [],
    editIntent: {
      delta: {
        version: 1,
        summary: 'Stopped by user.',
        scope: 'project',
        targetHints: [],
        directives: [],
        preserve: [],
      },
      source: 'fallback',
      reason: 'The edit was stopped before completion.',
    },
    contextSelection: {
      version: 1,
      relevantFiles: [],
      searchQuery: null,
      reason: 'The edit was stopped before completion.',
      source: 'fallback',
    },
    projectCheck: { ok: true, value: { status: 'PASS' } },
  };
}

async function runEditProject(
  projectId: string,
  prompt: string,
  selections: PreviewSelection[],
  options: EditProjectOptions,
): Promise<ProjectMessageResult> {
  throwIfAborted(options.signal);
  const routed: ProjectMessageRoutingResult = selections.length
    ? {
        decision: {
          version: 1,
          route: 'EDIT',
          confidence: 'high',
          message: 'Ready to update.',
        },
        conversation: null,
      }
    : await routeProjectMessage(projectId, prompt, options.signal);

  throwIfAborted(options.signal);
  if (routed.decision.route === 'CHAT' || routed.decision.route === 'CLARIFY') {
    const runtime = await startProjectRuntime(projectId, options.signal);
    throwIfAborted(options.signal);
    const frame = currentPreviewFrame();
    return {
      ...runtime,
      runId: '',
      status: 'COMPLETED',
      userRequest: prompt,
      conversation: routed.conversation ?? runtime.conversation,
      previewUrl: frame?.src || runtime.previewUrl,
      route: routed.decision.route,
      summary: routed.decision.message,
      model: 'project-message-router',
      changedFiles: [],
      editIntent: {
        delta: {
          version: 1,
          summary: routed.decision.message,
          scope: 'project',
          targetHints: [],
          directives: [],
          preserve: [],
        },
        source: 'fallback',
        reason: 'No source edit was executed.',
      },
      contextSelection: {
        version: 1,
        relevantFiles: [],
        searchQuery: null,
        reason: 'No source edit was executed.',
        source: 'fallback',
      },
      projectCheck: { ok: true, value: { status: 'PASS' } },
    };
  }

  const visualEditPrompt = buildVisualEditPrompt(prompt, selections);
  let step = await requestAgentEdit(projectId, visualEditPrompt, options);
  while (step.status === 'WAITING_FOR_CLIENT_TOOL') {
    throwIfAborted(options.signal);
    const toolResult = await executeClientTool(step, options.signal);
    throwIfAborted(options.signal);
    step = await continueAgentEdit(step.runId, toolResult, options.signal);
  }
  throwIfAborted(options.signal);
  return {
    ...step,
    route: routed.decision.route,
  };
}

export async function editProject(
  projectId: string,
  prompt: string,
  selections: PreviewSelection[] = getCurrentPreviewSelections(),
  options: EditProjectOptions = {},
): Promise<ProjectMessageResult> {
  const ownsController = !options.signal;
  const controller = ownsController ? new AbortController() : null;
  const signal = options.signal ?? controller!.signal;
  const callerOnRunStarted = options.onRunStarted;

  if (ownsController) {
    managedEditController = controller;
    managedEditRunId = null;
    managedStopPromise = null;
    managedStopStartedAt = 0;
    publishEditActivity('running', null);
  }

  const managedOptions: EditProjectOptions = {
    ...options,
    signal,
    onRunStarted: (runId) => {
      callerOnRunStarted?.(runId);
      if (!ownsController || managedEditController !== controller) return;
      managedEditRunId = runId;
      publishEditActivity(signal.aborted ? 'stopping' : 'running', runId);
      if (signal.aborted) {
        managedStopPromise = cancelAgentRun(runId).catch((error) => {
          console.warn('[Yakable] Could not persist the stopped Agent run.', error);
        });
      }
    },
  };

  try {
    return await runEditProject(projectId, prompt, selections, managedOptions);
  } catch (error) {
    if (!ownsController || !isAbortLike(error, signal)) throw error;
    await managedStopPromise?.catch(() => undefined);
    return stoppedEditResult(projectId, prompt, managedEditRunId);
  } finally {
    if (selections.length) clearCurrentPreviewSelections();
    if (ownsController && managedEditController === controller) {
      if (signal.aborted && managedStopStartedAt) {
        const elapsed = performance.now() - managedStopStartedAt;
        await delay(Math.max(0, STOPPING_FEEDBACK_MIN_MS - elapsed));
      }
      managedEditController = null;
      managedEditRunId = null;
      managedStopPromise = null;
      managedStopStartedAt = 0;
      publishEditActivity('idle', null);
    }
  }
}


