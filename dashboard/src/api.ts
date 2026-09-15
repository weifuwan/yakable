import {
  parseFrontendAgentEvent,
  publishFrontendAgentEvent,
} from './frontend-agent';
import {
  requestPreviewPageObservation,
  type PreviewPageObservation,
} from './preview-page-observation';
import {
  buildVisualEditPrompt,
  clearCurrentPreviewSelections,
  getCurrentPreviewSelections,
  type PreviewSelection,
} from './visual-edit-context';

export type ProjectTemplate = 'website' | 'app';
export type BuildIntentRoute = 'CREATE' | 'CHAT' | 'CLARIFY';
export type BuildIntentConfidence = 'high' | 'medium';

export interface BuildIntentDecision {
  version: 1;
  route: BuildIntentRoute;
  confidence: BuildIntentConfidence;
  message: string;
}

export type ProjectMessageRoute = 'CHAT' | 'CLARIFY' | 'BUILD' | 'EDIT';
export type ProjectMessageConfidence = 'high' | 'medium';

export interface ProjectMessageDecision {
  version: 1;
  route: ProjectMessageRoute;
  confidence: ProjectMessageConfidence;
  message: string;
}

export interface ProjectRoute {
  path: string;
  title: string;
}

export interface PersistedVisualSelection {
  sourceId?: string;
  file?: string;
  line?: number;
  column?: number;
  tagName: string;
  text: string;
  selector: string;
}

export interface ProjectEditHistoryItem {
  id: string;
  createdAt: string;
  userRequest: string;
  assistantSummary: string;
  changedFiles: string[];
  model?: string;
  visualSelections?: PersistedVisualSelection[];
}

export interface ProjectSession {
  version: 1;
  productRequest?: string;
  designIntent?: unknown;
  initialSummary?: string;
  createdAt: string;
  updatedAt: string;
  edits: ProjectEditHistoryItem[];
}

export interface ProjectConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  model?: string;
  changedFiles?: string[];
  visualSelections?: PersistedVisualSelection[];
  agentRun?: unknown;
}

export interface ProjectConversation {
  projectId: string;
  createdAt: string;
  updatedAt: string;
  messages: ProjectConversationMessage[];
}

export interface ProjectListItem {
  id: string;
  name: string;
  updatedAt: string;
  createdAt?: string;
  starred: boolean;
  template: ProjectTemplate;
  remixedFrom?: string;
}

export type EditIntentArea =
  | 'content'
  | 'visual-hierarchy'
  | 'composition'
  | 'typography'
  | 'color'
  | 'spacing-density'
  | 'surface-treatment'
  | 'imagery'
  | 'motion'
  | 'interaction'
  | 'responsive'
  | 'navigation'
  | 'component-expression';

export interface EditIntentDelta {
  version: 1;
  summary: string;
  scope: 'selection' | 'component' | 'section' | 'page' | 'project';
  targetHints: string[];
  directives: Array<{
    area: EditIntentArea;
    directive: string;
    basis: 'explicit' | 'interpreted';
  }>;
  preserve: string[];
}

export interface EditIntentResolution {
  delta: EditIntentDelta;
  source: 'model' | 'fallback';
  reason: string;
}

export interface EditContextSelection {
  version: 1;
  relevantFiles: string[];
  searchQuery: string | null;
  reason: string;
  source: 'visual' | 'model' | 'search' | 'fallback';
}

export type ProjectCheckResult =
  | { ok: true; value: { status: 'PASS' | 'FAIL' } }
  | { ok: false; error: { code: string; message: string } };

export interface DesignCriticFinding {
  area: EditIntentArea | 'runtime';
  severity: 'major' | 'minor';
  message: string;
  evidenceRefs: string[];
}

export interface DesignCriticResult {
  version: 1;
  status: 'PASS' | 'FAIL';
  summary: string;
  findings: DesignCriticFinding[];
  unverifiedAreas: EditIntentArea[];
}

export interface DesignCriticRun {
  model: string;
  result: DesignCriticResult;
}

export interface VisualRepairResult {
  attempted: boolean;
  status: 'NOT_NEEDED' | 'SKIPPED' | 'REPAIRED' | 'FAILED';
  contextFiles: string[];
  changedFiles: string[];
  projectCheck: ProjectCheckResult | null;
  rolledBack: boolean;
  model?: string;
  summary?: string;
  error?: string;
}

export type VisualFeedbackStatus =
  | 'PASS'
  | 'REPAIRED_PASS'
  | 'REPAIRED_FAIL'
  | 'REPAIR_FAILED'
  | 'SKIPPED'
  | 'ERROR';

export interface VisualFeedbackResult {
  status: VisualFeedbackStatus;
  initialObservation?: PreviewPageObservation;
  initialCritique?: DesignCriticRun;
  repair?: VisualRepairResult;
  finalObservation?: PreviewPageObservation;
  finalCritique?: DesignCriticRun;
  error?: string;
}

export interface RuntimeProject {
  projectId: string;
  name: string;
  starred: boolean;
  previewUrl: string;
  template: ProjectTemplate;
  routes: ProjectRoute[];
  session: ProjectSession | null;
  conversation: ProjectConversation | null;
}

export interface AgentClientToolRequest {
  toolCallId: string;
  toolName: 'observe_preview';
  iteration: 0 | 1;
  message: string;
}

export type UnifiedEditRunStatus = 'WAITING_FOR_CLIENT_TOOL' | 'COMPLETED' | 'FAILED';

export interface EditedProject extends RuntimeProject {
  runId: string;
  status: UnifiedEditRunStatus;
  userRequest: string;
  summary: string;
  model: string;
  changedFiles: string[];
  editIntent: EditIntentResolution;
  contextSelection: EditContextSelection;
  projectCheck: ProjectCheckResult;
  clientTool?: AgentClientToolRequest;
  visualFeedback?: VisualFeedbackResult;
}

export interface ProjectMessageResult extends EditedProject {
  route: ProjectMessageRoute;
}

interface ProjectMessageRoutingResult {
  decision: ProjectMessageDecision;
  conversation: ProjectConversation | null;
}

export interface EditProjectOptions {
  signal?: AbortSignal;
  onRunStarted?: (runId: string) => void;
}

export type EditActivityStatus = 'idle' | 'running' | 'stopping';

export interface EditActivitySnapshot {
  status: EditActivityStatus;
  runId: string | null;
}

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
  if (editActivitySnapshot.status === next.status && editActivitySnapshot.runId === next.runId) return;
  editActivitySnapshot = next;
  for (const listener of editActivityListeners) listener();
}

function abortError(signal?: AbortSignal): Error {
  const reason = signal?.reason;
  if (reason instanceof Error) return reason;
  const error = new Error(typeof reason === 'string' && reason.trim() ? reason : 'Stopped by user.');
  error.name = 'AbortError';
  return error;
}

function isAbortLike(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return error instanceof Error
    && (error.name === 'AbortError' || error.name === 'OperationCancelledError');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError(signal);
}

function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const onAbort = () => settle(() => reject(abortError(signal)));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => settle(() => resolve(value)),
      (error) => settle(() => reject(error)),
    );
  });
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(payload.error || `Yakable API failed with HTTP ${response.status}.`);
  }
  return payload;
}

function parseRecord(line: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(line);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('Agent stream returned an invalid record.');
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Agent stream returned invalid JSON.');
    throw error;
  }
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
    return {
      type: record.type,
      result: record.result as EditedProject,
    };
  }
  if (record.type === 'error' && typeof record.error === 'string') {
    return { type: 'error', error: record.error };
  }
  throw new Error('Edit Agent stream returned an unknown record type.');
}

async function consumeNdjson<T>(
  response: Response,
  consumeLine: (line: string) => void,
  getResult: () => T | null,
  signal?: AbortSignal,
): Promise<T> {
  throwIfAborted(signal);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || `Yakable API failed with HTTP ${response.status}.`);
  }
  if (!response.body) throw new Error('Agent stream is not available in this browser.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    throwIfAborted(signal);
    const chunk = await reader.read();
    throwIfAborted(signal);
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
  throwIfAborted(signal);
  const result = getResult();
  if (!result) throw new Error('Agent stream ended without a result.');
  return result;
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

export async function listProjects(): Promise<ProjectListItem[]> {
  const result = await requestJson<{ projects: ProjectListItem[] }>('/api/projects');
  return result.projects;
}

export function startProjectRuntime(
  projectId: string,
  signal?: AbortSignal,
): Promise<RuntimeProject> {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}/runtime`, {
    method: 'POST',
    body: '{}',
    signal,
  });
}

function routeProjectMessage(
  projectId: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<ProjectMessageRoutingResult> {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}/message`, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
    signal,
  });
}

export async function cancelAgentRun(runId: string): Promise<void> {
  if (!runId.trim()) return;
  await requestJson<{ ok: true; runId: string; cancelled: boolean }>(
    `/api/agent-runs/${encodeURIComponent(runId)}/cancel`,
    { method: 'POST', body: '{}' },
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

export async function updateProject(
  projectId: string,
  patch: { name?: string; starred?: boolean },
): Promise<ProjectListItem> {
  const result = await requestJson<{ project: ProjectListItem }>(
    `/api/projects/${encodeURIComponent(projectId)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
  return result.project;
}

export async function remixProject(projectId: string): Promise<ProjectListItem> {
  const result = await requestJson<{ project: ProjectListItem }>(
    `/api/projects/${encodeURIComponent(projectId)}/remix`,
    { method: 'POST', body: '{}' },
  );
  return result.project;
}

export async function deleteProject(projectId: string): Promise<void> {
  await requestJson<{ ok: true; projectId: string }>(
    `/api/projects/${encodeURIComponent(projectId)}`,
    { method: 'DELETE' },
  );
}
