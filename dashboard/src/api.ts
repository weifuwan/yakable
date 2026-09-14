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
  model?: string;
  summary?: string;
  error?: string;
  rolledBack?: boolean;
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
  visualFeedback?: VisualFeedbackResult;
}

interface VisualRepairResponse extends RuntimeProject {
  visualRepair: VisualRepairResult;
}

const PREVIEW_RELOAD_TIMEOUT_MS = 8_000;

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

export async function listProjects(): Promise<ProjectListItem[]> {
  const result = await requestJson<{ projects: ProjectListItem[] }>('/api/projects');
  return result.projects;
}

export function createProject(prompt: string): Promise<CreateProjectResult> {
  return requestJson('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

export function startProjectRuntime(projectId: string): Promise<RuntimeProject> {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}/runtime`, {
    method: 'POST',
    body: '{}',
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
): Promise<EditedProject> {
  if (!healthyProjectCheck(edited.projectCheck)) {
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
    await reloadPreviewFrame(frame, current.previewUrl);
    initialObservation = await requestPreviewPageObservation(frame);
    initialCritique = (
      await critiqueProjectDesign(projectId, current.editIntent.delta, initialObservation)
    ).critique;

    if (initialCritique.result.status === 'PASS') {
      return {
        ...current,
        visualFeedback: {
          status: 'PASS',
          initialObservation,
          initialCritique,
        },
      };
    }

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
      changedFiles: mergeChangedFiles(current.changedFiles, repair.changedFiles),
    };

    if (repair.status !== 'REPAIRED' || !repair.projectCheck || !healthyProjectCheck(repair.projectCheck)) {
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

    await reloadPreviewFrame(frame, current.previewUrl);
    const finalObservation = await requestPreviewPageObservation(frame);
    const finalCritique = (
      await critiqueProjectDesign(projectId, current.editIntent.delta, finalObservation)
    ).critique;

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
): Promise<EditedProject> {
  const visualEditPrompt = buildVisualEditPrompt(prompt, selections);
  const edited = await requestJson<EditedProject>(
    `/api/projects/${encodeURIComponent(projectId)}/edit`,
    {
      method: 'POST',
      body: JSON.stringify({ prompt: visualEditPrompt }),
    },
  );

  const result = await runVisualFeedback(projectId, prompt, edited);
  if (selections.length) clearCurrentPreviewSelections();
  return result;
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
