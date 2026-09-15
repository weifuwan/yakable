import {
  createFrontendAgentEvent,
  parseFrontendAgentEvent,
  publishFrontendAgentEvent,
  type FrontendAgentEvent,
  type FrontendAgentState,
  type FrontendAgentStepStatus,
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

export interface CreatedProject {
  id: string;
  name: string;
  summary: string;
  model: string;
  template: ProjectTemplate;
  routes: ProjectRoute[];
  agentRunId?: string;
  session: ProjectSession | null;
  conversation: ProjectConversation | null;
}

export interface CreateProjectResult {
  decision: BuildIntentDecision;
  project?: CreatedProject;
  previewUrl?: string;
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

export interface EditedProject extends RuntimeProject {
  summary: string;
  model: string;
  changedFiles: string[];
  editIntent: EditIntentResolution;
  contextSelection: EditContextSelection;
  projectCheck: ProjectCheckResult;
  agentTrace?: FrontendAgentEvent[];
  visualFeedback?: VisualFeedbackResult;
}

export interface ProjectMessageResult extends RuntimeProject {
  route: ProjectMessageRoute;
  summary: string;
  model: string;
  changedFiles: string[];
  agentTrace?: FrontendAgentEvent[];
  visualFeedback?: VisualFeedbackResult;
}

interface ProjectMessageRoutingResult {
  decision: ProjectMessageDecision;
  conversation: ProjectConversation | null;
}

interface VisualRepairResponse extends RuntimeProject {
  visualRepair: VisualRepairResult;
}

type AgentCreateStreamRecord =
  | { type: 'agent-event'; event: unknown }
  | { type: 'result'; result: CreateProjectResult }
  | { type: 'error'; error: string };

type AgentEditStreamRecord =
  | { type: 'agent-event'; event: unknown }
  | { type: 'result'; result: EditedProject }
  | { type: 'error'; error: string };

const PREVIEW_RELOAD_TIMEOUT_MS = 8_000;
let nextAgentRunId = 1;

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

function publishAgentState(
  runId: string,
  state: FrontendAgentState,
  status: FrontendAgentStepStatus,
  message: string,
  iteration?: 0 | 1,
): void {
  publishFrontendAgentEvent(
    runId,
    createFrontendAgentEvent(state, status, message, iteration),
  );
}

function createAgentRunId(projectId: string): string {
  return `${projectId}-${Date.now()}-${nextAgentRunId++}`;
}

function parseAgentCreateStreamRecord(line: string): AgentCreateStreamRecord {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error('Create Agent stream returned invalid JSON.');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Create Agent stream returned an invalid record.');
  }
  const record = value as Record<string, unknown>;
  if (record.type === 'agent-event') return { type: 'agent-event', event: record.event };
  if (record.type === 'result' && record.result && typeof record.result === 'object') {
    return { type: 'result', result: record.result as CreateProjectResult };
  }
  if (record.type === 'error' && typeof record.error === 'string') {
    return { type: 'error', error: record.error };
  }
  throw new Error('Create Agent stream returned an unknown record type.');
}

function parseAgentStreamRecord(line: string): AgentEditStreamRecord {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error('Frontend Agent stream returned invalid JSON.');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Frontend Agent stream returned an invalid record.');
  }
  const record = value as Record<string, unknown>;
  if (record.type === 'agent-event') return { type: 'agent-event', event: record.event };
  if (record.type === 'result' && record.result && typeof record.result === 'object') {
    return { type: 'result', result: record.result as EditedProject };
  }
  if (record.type === 'error' && typeof record.error === 'string') {
    return { type: 'error', error: record.error };
  }
  throw new Error('Frontend Agent stream returned an unknown record type.');
}

async function requestAgentCreate(
  prompt: string,
  runId: string,
): Promise<CreateProjectResult> {
  const response = await fetch('/api/projects/agent-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || `Yakable API failed with HTTP ${response.status}.`);
  }
  if (!response.body) {
    throw new Error('Create Agent stream is not available in this browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: CreateProjectResult | null = null;

  const consumeLine = (line: string) => {
    if (!line.trim()) return;
    const record = parseAgentCreateStreamRecord(line);
    if (record.type === 'agent-event') {
      publishFrontendAgentEvent(runId, parseFrontendAgentEvent(record.event));
      return;
    }
    if (record.type === 'error') throw new Error(record.error);
    result = record.result;
  };

  while (true) {
    const chunk = await reader.read();
    buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      consumeLine(line);
      newline = buffer.indexOf('\n');
    }
    if (chunk.done) break;
  }

  if (buffer.trim()) consumeLine(buffer);
  if (!result) throw new Error('Create Agent stream ended without a project result.');
  return result;
}

async function requestAgentEdit(
  projectId: string,
  prompt: string,
  runId: string,
): Promise<EditedProject> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/agent-edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || `Yakable API failed with HTTP ${response.status}.`);
  }
  if (!response.body) {
    throw new Error('Frontend Agent stream is not available in this browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: EditedProject | null = null;

  const consumeLine = (line: string) => {
    if (!line.trim()) return;
    const record = parseAgentStreamRecord(line);
    if (record.type === 'agent-event') {
      publishFrontendAgentEvent(runId, parseFrontendAgentEvent(record.event));
      return;
    }
    if (record.type === 'error') throw new Error(record.error);
    result = record.result;
  };

  while (true) {
    const chunk = await reader.read();
    buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      consumeLine(line);
      newline = buffer.indexOf('\n');
    }
    if (chunk.done) break;
  }

  if (buffer.trim()) consumeLine(buffer);
  if (!result) throw new Error('Frontend Agent stream ended without an edit result.');
  return result;
}

export async function listProjects(): Promise<ProjectListItem[]> {
  const result = await requestJson<{ projects: ProjectListItem[] }>('/api/projects');
  return result.projects;
}

export function createProject(prompt: string): Promise<CreateProjectResult> {
  return requestAgentCreate(prompt, createAgentRunId('create'));
}

export function startProjectRuntime(projectId: string): Promise<RuntimeProject> {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}/runtime`, {
    method: 'POST',
    body: '{}',
  });
}

function routeProjectMessage(
  projectId: string,
  prompt: string,
): Promise<ProjectMessageRoutingResult> {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}/message`, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

export function critiqueProjectDesign(
  projectId: string,
  editIntent: EditIntentDelta,
  pageObservation: PreviewPageObservation,
): Promise<{ critique: DesignCriticRun }> {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}/critique`, {
    method: 'POST',
    body: JSON.stringify({ editIntent, pageObservation }),
  });
}

export function repairProjectVisual(
  projectId: string,
  input: {
    userRequest: string;
    editIntent: EditIntentDelta;
    critique: DesignCriticResult;
    pageObservation: PreviewPageObservation;
    initialChangedFiles: string[];
    selectedContextFiles: string[];
  },
): Promise<VisualRepairResponse> {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}/visual-repair`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
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
): Promise<void> {
  const nextUrl = preservePreviewRoute(runtimeUrl, frame);

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      frame.removeEventListener('load', onLoad);
      window.clearTimeout(timeout);
    };
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const onLoad = () => settle(resolve);
    const timeout = window.setTimeout(() => {
      settle(() => reject(new Error('Preview reload timed out before visual feedback.')));
    }, timeoutMs);

    frame.addEventListener('load', onLoad);
    frame.src = nextUrl;
  });
}

function healthyProjectCheck(check: ProjectCheckResult): boolean {
  return check.ok && check.value.status === 'PASS';
}

function mergeChangedFiles(initial: string[], repair: string[]): string[] {
  return [...new Set([...initial, ...repair])];
}

async function runVisualFeedback(
  projectId: string,
  userRequest: string,
  edited: EditedProject,
  runId: string,
): Promise<EditedProject> {
  if (!healthyProjectCheck(edited.projectCheck)) {
    publishAgentState(
      runId,
      'DONE',
      'FAILED',
      'Stopped before visual feedback because the edited project is not code-healthy',
    );
    return {
      ...edited,
      visualFeedback: {
        status: 'SKIPPED',
        error: 'Visual feedback skipped because the edited project is not code-healthy.',
      },
    };
  }

  const frame = currentPreviewFrame();
  if (!frame) {
    publishAgentState(runId, 'OBSERVE', 'SKIPPED', 'Active Preview frame was not found', 0);
    publishAgentState(runId, 'DONE', 'SKIPPED', 'Stopped because Preview observation is unavailable');
    return {
      ...edited,
      visualFeedback: {
        status: 'SKIPPED',
        error: 'Visual feedback skipped because the active Preview frame was not found.',
      },
    };
  }

  let current = edited;
  let initialObservation: PreviewPageObservation | undefined;
  let initialCritique: DesignCriticRun | undefined;
  let repair: VisualRepairResult | undefined;

  try {
    publishAgentState(runId, 'OBSERVE', 'ACTIVE', 'Rendering and observing the current Preview', 0);
    await reloadPreviewFrame(frame, current.previewUrl);
    initialObservation = await requestPreviewPageObservation(frame);
    publishAgentState(
      runId,
      'OBSERVE',
      'COMPLETED',
      `Observed ${initialObservation.elements.length} visible key element(s)`,
      0,
    );

    publishAgentState(runId, 'CRITIQUE', 'ACTIVE', 'Checking the rendered result against design intent', 0);
    initialCritique = (
      await critiqueProjectDesign(projectId, current.editIntent.delta, initialObservation)
    ).critique;
    publishAgentState(
      runId,
      'CRITIQUE',
      'COMPLETED',
      initialCritique.result.status === 'PASS'
        ? 'No concrete observable mismatch was found'
        : `Found ${initialCritique.result.findings.length} grounded design issue(s)`,
      0,
    );

    if (initialCritique.result.status === 'PASS') {
      publishAgentState(runId, 'DONE', 'COMPLETED', 'Frontend edit passed the bounded feedback loop');
      return {
        ...current,
        visualFeedback: {
          status: 'PASS',
          initialObservation,
          initialCritique,
        },
      };
    }

    publishAgentState(runId, 'REPAIR', 'ACTIVE', 'Applying one bounded visual repair');
    const repairResponse = await repairProjectVisual(projectId, {
      userRequest,
      editIntent: current.editIntent.delta,
      critique: initialCritique.result,
      pageObservation: initialObservation,
      initialChangedFiles: current.changedFiles,
      selectedContextFiles: current.contextSelection.relevantFiles,
    });
    repair = repairResponse.visualRepair;
    current = {
      ...current,
      previewUrl: repairResponse.previewUrl,
      session: repairResponse.session,
      conversation: repairResponse.conversation,
      changedFiles:
        repair.status === 'REPAIRED'
          ? mergeChangedFiles(current.changedFiles, repair.changedFiles)
          : current.changedFiles,
    };

    if (repair.status !== 'REPAIRED' || !repair.projectCheck || !healthyProjectCheck(repair.projectCheck)) {
      publishAgentState(
        runId,
        'REPAIR',
        'FAILED',
        repair.rolledBack
          ? 'Visual repair failed project health checks and was rolled back'
          : repair.error || 'Visual repair did not produce a healthy project',
      );
      publishAgentState(runId, 'DONE', 'FAILED', 'Stopped after the single allowed visual repair');
      return {
        ...current,
        visualFeedback: {
          status: 'REPAIR_FAILED',
          initialObservation,
          initialCritique,
          repair,
          ...(repair.error ? { error: repair.error } : {}),
        },
      };
    }

    publishAgentState(runId, 'REPAIR', 'COMPLETED', 'Applied one code-healthy visual repair');
    publishAgentState(runId, 'OBSERVE', 'ACTIVE', 'Re-observing the repaired Preview', 1);
    await reloadPreviewFrame(frame, current.previewUrl);
    const finalObservation = await requestPreviewPageObservation(frame);
    publishAgentState(
      runId,
      'OBSERVE',
      'COMPLETED',
      `Observed ${finalObservation.elements.length} key element(s) after repair`,
      1,
    );

    publishAgentState(runId, 'CRITIQUE', 'ACTIVE', 'Running the final bounded design critique', 1);
    const finalCritique = (
      await critiqueProjectDesign(projectId, current.editIntent.delta, finalObservation)
    ).critique;
    publishAgentState(
      runId,
      'CRITIQUE',
      'COMPLETED',
      finalCritique.result.status === 'PASS'
        ? 'The repaired result passed observable design checks'
        : `${finalCritique.result.findings.length} grounded issue(s) remain after the single repair`,
      1,
    );
    publishAgentState(
      runId,
      'DONE',
      'COMPLETED',
      finalCritique.result.status === 'PASS'
        ? 'Frontend feedback loop completed successfully'
        : 'Frontend feedback loop stopped at its one-repair boundary',
    );

    return {
      ...current,
      visualFeedback: {
        status: finalCritique.result.status === 'PASS' ? 'REPAIRED_PASS' : 'REPAIRED_FAIL',
        initialObservation,
        initialCritique,
        repair,
        finalObservation,
        finalCritique,
      },
    };
  } catch (error) {
    publishAgentState(
      runId,
      'DONE',
      'FAILED',
      `Frontend feedback stopped: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      ...current,
      visualFeedback: {
        status: 'ERROR',
        ...(initialObservation ? { initialObservation } : {}),
        ...(initialCritique ? { initialCritique } : {}),
        ...(repair ? { repair } : {}),
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function editProject(
  projectId: string,
  prompt: string,
  selections: PreviewSelection[] = getCurrentPreviewSelections(),
): Promise<ProjectMessageResult> {
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
    : await routeProjectMessage(projectId, prompt);

  if (routed.decision.route === 'CHAT' || routed.decision.route === 'CLARIFY') {
    const runtime = await startProjectRuntime(projectId);
    const frame = currentPreviewFrame();
    return {
      ...runtime,
      previewUrl: frame?.src || runtime.previewUrl,
      conversation: routed.conversation ?? runtime.conversation,
      route: routed.decision.route,
      summary: routed.decision.message,
      model: 'project-message-router',
      changedFiles: [],
    };
  }

  const runId = createAgentRunId(projectId);
  const visualEditPrompt = buildVisualEditPrompt(prompt, selections);

  try {
    const edited = await requestAgentEdit(projectId, visualEditPrompt, runId);
    const result = await runVisualFeedback(projectId, prompt, edited, runId);
    return {
      ...result,
      route: routed.decision.route,
    };
  } catch (error) {
    publishAgentState(
      runId,
      'DONE',
      'FAILED',
      `Frontend Agent stopped: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  } finally {
    if (selections.length) clearCurrentPreviewSelections();
  }
}

export async function updateProject(
  projectId: string,
  patch: { name?: string; starred?: boolean },
): Promise<ProjectListItem> {
  const result = await requestJson<{ project: ProjectListItem }>(
    `/api/projects/${encodeURIComponent(projectId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  );
  return result.project;
}

export async function remixProject(projectId: string): Promise<ProjectListItem> {
  const result = await requestJson<{ project: ProjectListItem }>(
    `/api/projects/${encodeURIComponent(projectId)}/remix`,
    {
      method: 'POST',
      body: '{}',
    },
  );
  return result.project;
}

export async function deleteProject(projectId: string): Promise<void> {
  await requestJson<{ ok: true; projectId: string }>(
    `/api/projects/${encodeURIComponent(projectId)}`,
    { method: 'DELETE' },
  );
}
