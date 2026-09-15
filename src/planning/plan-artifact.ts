import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  selectProjectContextFiles,
  type EditContextSelection,
} from '../editing/context-selection.js';
import { resolveProjectContextSearch } from '../editing/context-search.js';
import {
  listProjectContextFiles,
  readProjectSnapshot,
} from '../editing/edit.js';
import { requestPlanArtifact } from '../model/capabilities.js';
import { defaultModelClient } from '../model/default-client.js';
import type { ModelClient } from '../model/model-client.js';
import {
  assertModeCapability,
  type YakableMode,
} from '../modes/mode-contract.js';
import { readProjectSession } from '../projects/project-session.js';
import { resolveGeneratedProject } from '../runtime/runtime.js';
import type { DesignIntentIR, GeneratedFile } from '../types.js';
import {
  parseUiPlanValue,
  planInterface,
  type UiPlan,
  type UiPlannerResult,
} from './ui-planner.js';

export const PLAN_ARTIFACT_VERSION = 1 as const;
export const PLAN_ARTIFACT_JSON_PATH = '.yakable/plan.json';
export const PLAN_ARTIFACT_MARKDOWN_PATH = '.yakable/plan.md';
export const PLAN_ARTIFACT_MAX_DECISIONS = 12;
export const PLAN_ARTIFACT_MAX_STEPS = 12;
export const PLAN_ARTIFACT_MAX_LIST_ITEMS = 12;
export const PLAN_ARTIFACT_MAX_OPEN_QUESTIONS = 8;
export const PLAN_ARTIFACT_MAX_CONTEXT_FILES = 12;
export const PLAN_ARTIFACT_MAX_REQUEST_CHARS = 900_000;
const PLAN_ARTIFACT_MAX_USER_REQUEST = 8_000;
const PLAN_ARTIFACT_MAX_SHORT_TEXT = 240;
const PLAN_ARTIFACT_MAX_TEXT = 1_200;
const PLAN_ARTIFACT_MAX_REVIEW_NOTE = 1_000;

export const PLAN_ARTIFACT_STATUSES = ['DRAFT', 'APPROVED', 'REJECTED'] as const;
export type PlanArtifactStatus = (typeof PLAN_ARTIFACT_STATUSES)[number];
export type PlanReviewAction = 'APPROVE' | 'REJECT';

export interface PlanArtifactContext {
  projectType: string;
  relevantFiles: string[];
  currentBehavior?: string;
}

export interface PlanArtifactDecision {
  decision: string;
  reason: string;
}

export interface PlanArtifactImplementationStep {
  id: string;
  title: string;
  purpose: string;
  files: string[];
}

export interface PlanArtifactContent {
  goal: string;
  context: PlanArtifactContext;
  decisions: PlanArtifactDecision[];
  ui?: UiPlan;
  implementation: PlanArtifactImplementationStep[];
  validation: string[];
  constraints: string[];
  openQuestions: string[];
}

export interface PlanArtifact extends PlanArtifactContent {
  version: 1;
  revision: number;
  status: PlanArtifactStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface PlanArtifactBundle {
  plan: PlanArtifact;
  markdown: string;
}

export interface DraftProjectPlanOptions {
  mode?: YakableMode;
  generatedRoot?: string;
  modelClient?: ModelClient;
}

export interface ReviewProjectPlanOptions {
  mode?: YakableMode;
  generatedRoot?: string;
}

export interface PlanArtifactRun extends PlanArtifactBundle {
  model: string;
  contextSelection: EditContextSelection;
  uiPlannerModel: string;
  uiPlanner: UiPlannerResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, field: string, maxLength = PLAN_ARTIFACT_MAX_TEXT): string {
  if (typeof value !== 'string') {
    throw new Error(`Plan Artifact ${field} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`Plan Artifact ${field} must contain 1-${maxLength} characters.`);
  }
  return normalized;
}

function readOptionalString(
  value: unknown,
  field: string,
  maxLength = PLAN_ARTIFACT_MAX_TEXT,
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return readString(value, field, maxLength);
}

function readTimestamp(value: unknown, field: string): string {
  const timestamp = readString(value, field, 80);
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new Error(`Plan Artifact ${field} must be an ISO timestamp.`);
  }
  return timestamp;
}

function validatePlanPath(value: string, field: string): string {
  const candidate = value.trim();
  if (
    !candidate
    || candidate.length > 240
    || candidate.includes(String.fromCharCode(0))
    || candidate.includes('\\')
    || /[\r\n]/.test(candidate)
    || candidate.startsWith('/')
    || path.posix.isAbsolute(candidate)
  ) {
    throw new Error(`Plan Artifact ${field} contains an invalid project path.`);
  }

  const normalized = path.posix.normalize(candidate);
  const segments = candidate.split('/');
  if (
    normalized !== candidate
    || segments.some((segment) => segment === '.' || segment === '..')
    || candidate.startsWith('.yakable/')
    || path.posix.basename(candidate).startsWith('.env')
  ) {
    throw new Error(`Plan Artifact ${field} contains an unsafe project path: ${candidate}.`);
  }
  return candidate;
}

function readPathArray(
  value: unknown,
  field: string,
  maxItems: number,
  allowed?: Set<string>,
): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`Plan Artifact ${field} must contain at most ${maxItems} paths.`);
  }

  const paths: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new Error(`Plan Artifact ${field} must contain string paths only.`);
    }
    const planPath = validatePlanPath(item, field);
    if (allowed && !allowed.has(planPath)) {
      throw new Error(`Plan Artifact ${field} referenced unavailable context: ${planPath}.`);
    }
    if (!paths.includes(planPath)) paths.push(planPath);
  }
  return paths;
}

function readStringArray(
  value: unknown,
  field: string,
  maxItems: number,
  maxLength = PLAN_ARTIFACT_MAX_TEXT,
): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`Plan Artifact ${field} must contain at most ${maxItems} items.`);
  }
  const result: string[] = [];
  for (const [index, item] of value.entries()) {
    const text = readString(item, `${field}[${index}]`, maxLength);
    if (!result.includes(text)) result.push(text);
  }
  return result;
}

function readDecisions(value: unknown): PlanArtifactDecision[] {
  if (!Array.isArray(value) || value.length > PLAN_ARTIFACT_MAX_DECISIONS) {
    throw new Error(
      `Plan Artifact decisions must contain at most ${PLAN_ARTIFACT_MAX_DECISIONS} items.`,
    );
  }
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`Plan Artifact decisions[${index}] must be an object.`);
    return {
      decision: readString(item.decision, `decisions[${index}].decision`, 600),
      reason: readString(item.reason, `decisions[${index}].reason`, 800),
    };
  });
}

function readImplementation(value: unknown): PlanArtifactImplementationStep[] {
  if (!Array.isArray(value) || value.length > PLAN_ARTIFACT_MAX_STEPS) {
    throw new Error(
      `Plan Artifact implementation must contain at most ${PLAN_ARTIFACT_MAX_STEPS} steps.`,
    );
  }

  const ids = new Set<string>();
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`Plan Artifact implementation[${index}] must be an object.`);
    }
    const id = readString(item.id, `implementation[${index}].id`, 80);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) || ids.has(id)) {
      throw new Error(`Plan Artifact implementation[${index}].id must be unique and stable.`);
    }
    ids.add(id);
    return {
      id,
      title: readString(item.title, `implementation[${index}].title`, PLAN_ARTIFACT_MAX_SHORT_TEXT),
      purpose: readString(item.purpose, `implementation[${index}].purpose`, 900),
      files: readPathArray(item.files ?? [], `implementation[${index}].files`, 8),
    };
  });
}

export function parsePlanArtifactContent(
  rawContent: string,
  allowedRelevantFiles?: string[],
): PlanArtifactContent {
  let value: unknown;
  try {
    value = JSON.parse(rawContent);
  } catch {
    throw new Error('Plan Artifact model output was not valid JSON.');
  }
  if (!isRecord(value) || !isRecord(value.context)) {
    throw new Error('Plan Artifact output must be a JSON object with context.');
  }

  const allowed = allowedRelevantFiles
    ? new Set(allowedRelevantFiles.map((file) => file.trim()).filter(Boolean))
    : undefined;
  const currentBehavior = readOptionalString(value.context.currentBehavior, 'context.currentBehavior');

  return {
    goal: readString(value.goal, 'goal'),
    context: {
      projectType: readString(value.context.projectType, 'context.projectType', PLAN_ARTIFACT_MAX_SHORT_TEXT),
      relevantFiles: readPathArray(
        value.context.relevantFiles,
        'context.relevantFiles',
        PLAN_ARTIFACT_MAX_CONTEXT_FILES,
        allowed,
      ),
      ...(currentBehavior ? { currentBehavior } : {}),
    },
    decisions: readDecisions(value.decisions),
    ...(value.ui !== undefined && value.ui !== null ? { ui: parseUiPlanValue(value.ui) } : {}),
    implementation: readImplementation(value.implementation),
    validation: readStringArray(
      value.validation,
      'validation',
      PLAN_ARTIFACT_MAX_LIST_ITEMS,
      800,
    ),
    constraints: readStringArray(
      value.constraints,
      'constraints',
      PLAN_ARTIFACT_MAX_LIST_ITEMS,
      800,
    ),
    openQuestions: readStringArray(
      value.openQuestions,
      'openQuestions',
      PLAN_ARTIFACT_MAX_OPEN_QUESTIONS,
      800,
    ),
  };
}

export function parsePlanArtifact(rawContent: string): PlanArtifact {
  let value: unknown;
  try {
    value = JSON.parse(rawContent);
  } catch {
    throw new Error('Persisted Plan Artifact is not valid JSON.');
  }
  if (!isRecord(value) || value.version !== PLAN_ARTIFACT_VERSION) {
    throw new Error('Persisted Plan Artifact must be a version 1 object.');
  }
  if (
    typeof value.revision !== 'number'
    || !Number.isInteger(value.revision)
    || value.revision < 1
  ) {
    throw new Error('Persisted Plan Artifact revision must be a positive integer.');
  }
  if (
    typeof value.status !== 'string'
    || !PLAN_ARTIFACT_STATUSES.includes(value.status as PlanArtifactStatus)
  ) {
    throw new Error('Persisted Plan Artifact has an invalid status.');
  }

  const content = parsePlanArtifactContent(JSON.stringify(value));
  return {
    version: PLAN_ARTIFACT_VERSION,
    revision: value.revision,
    status: value.status as PlanArtifactStatus,
    ...content,
    createdAt: readTimestamp(value.createdAt, 'createdAt'),
    updatedAt: readTimestamp(value.updatedAt, 'updatedAt'),
    ...(value.reviewedAt !== undefined
      ? { reviewedAt: readTimestamp(value.reviewedAt, 'reviewedAt') }
      : {}),
    ...(value.reviewNote !== undefined
      ? { reviewNote: readString(value.reviewNote, 'reviewNote', PLAN_ARTIFACT_MAX_REVIEW_NOTE) }
      : {}),
  };
}

function markdownText(value: string): string {
  return value.replace(/\r?\n+/g, ' ').trim();
}

function markdownList(values: string[], empty = '_None_'): string {
  return values.length
    ? values.map((value) => `- ${markdownText(value)}`).join('\n')
    : empty;
}

function renderUiPlanMarkdown(ui: UiPlan): string[] {
  const sections = ui.sections
    .map((section, index) => [
      `${index + 1}. **${markdownText(section.title)}** — ${section.priority} · ${section.pattern}`,
      `   - Purpose: ${markdownText(section.purpose)}`,
      ...(section.content.length
        ? section.content.map((item) => `   - Content: ${markdownText(item)}`)
        : []),
    ].join('\n'))
    .join('\n');

  return [
    '',
    '## UI Blueprint',
    '',
    `- Scope: ${ui.scope}`,
    `- Page type: ${markdownText(ui.pageType)}`,
    `- Navigation: ${ui.shell.navigation}`,
    `- Density: ${ui.shell.density}`,
    `- Content width: ${ui.shell.contentWidth}`,
    `- Primary hierarchy: ${markdownText(ui.hierarchy.primary)}`,
    ...(ui.hierarchy.secondary.length
      ? [`- Secondary hierarchy: ${ui.hierarchy.secondary.map(markdownText).join('; ')}`]
      : []),
    '',
    '### Sections',
    '',
    sections || '_None_',
    '',
    '### Responsive',
    '',
    markdownList(ui.responsive),
    '',
    '### Deliberate omissions',
    '',
    markdownList(ui.deliberateOmissions),
  ];
}

export function renderPlanArtifactMarkdown(plan: PlanArtifact): string {
  const decisions = plan.decisions.length
    ? plan.decisions
        .map(
          (item, index) =>
            `${index + 1}. **${markdownText(item.decision)}**\n   - ${markdownText(item.reason)}`,
        )
        .join('\n')
    : '_None_';
  const implementation = plan.implementation.length
    ? plan.implementation
        .map((step, index) => {
          const files = step.files.length ? `\n   - Files: ${step.files.join(', ')}` : '';
          return `${index + 1}. **${markdownText(step.title)}** — ${markdownText(step.purpose)}${files}`;
        })
        .join('\n')
    : '_None_';

  return [
    '# Yakable Plan',
    '',
    `> Revision ${plan.revision} · ${plan.status}`,
    '',
    '## Goal',
    '',
    markdownText(plan.goal),
    '',
    '## Context',
    '',
    `- Project type: ${markdownText(plan.context.projectType)}`,
    `- Relevant files: ${plan.context.relevantFiles.length ? plan.context.relevantFiles.join(', ') : 'None selected'}`,
    ...(plan.context.currentBehavior
      ? [`- Current behavior: ${markdownText(plan.context.currentBehavior)}`]
      : []),
    ...(plan.ui ? renderUiPlanMarkdown(plan.ui) : []),
    '',
    '## Decisions',
    '',
    decisions,
    '',
    '## Implementation',
    '',
    implementation,
    '',
    '## Validation',
    '',
    markdownList(plan.validation),
    '',
    '## Constraints',
    '',
    markdownList(plan.constraints),
    '',
    '## Open Questions',
    '',
    markdownList(plan.openQuestions),
    ...(plan.reviewedAt
      ? [
          '',
          '## Review',
          '',
          `- Reviewed at: ${plan.reviewedAt}`,
          ...(plan.reviewNote ? [`- Note: ${markdownText(plan.reviewNote)}`] : []),
        ]
      : []),
    '',
  ].join('\n');
}

function planStoragePaths(projectDirectory: string) {
  const metadataDirectory = path.join(projectDirectory, '.yakable');
  return {
    metadataDirectory,
    jsonPath: path.join(projectDirectory, ...PLAN_ARTIFACT_JSON_PATH.split('/')),
    markdownPath: path.join(projectDirectory, ...PLAN_ARTIFACT_MARKDOWN_PATH.split('/')),
  };
}

async function persistPlanArtifact(
  projectDirectory: string,
  plan: PlanArtifact,
  mode: YakableMode,
): Promise<PlanArtifactBundle> {
  assertModeCapability(mode, 'write-plan');
  const normalized = parsePlanArtifact(JSON.stringify(plan));
  const markdown = renderPlanArtifactMarkdown(normalized);
  const paths = planStoragePaths(projectDirectory);
  await mkdir(paths.metadataDirectory, { recursive: true });

  const nonce = `${process.pid}-${Date.now()}`;
  const jsonTemporary = `${paths.jsonPath}.${nonce}.tmp`;
  const markdownTemporary = `${paths.markdownPath}.${nonce}.tmp`;
  await writeFile(jsonTemporary, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  await writeFile(markdownTemporary, markdown, 'utf8');
  await rename(jsonTemporary, paths.jsonPath);
  await rename(markdownTemporary, paths.markdownPath);
  return { plan: normalized, markdown };
}

export async function readPlanArtifactFromDirectory(
  projectDirectory: string,
  mode: YakableMode = 'BUILD',
): Promise<PlanArtifact | null> {
  assertModeCapability(mode, 'read-plan');
  const { jsonPath } = planStoragePaths(projectDirectory);
  const content = await readFile(jsonPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  return content === null ? null : parsePlanArtifact(content);
}

function validatePlanningRequest(userRequest: string): string {
  const request = userRequest.trim();
  if (!request) throw new Error('A planning request is required.');
  if (request.length > PLAN_ARTIFACT_MAX_USER_REQUEST) {
    throw new Error(
      `Planning request is too long (max ${PLAN_ARTIFACT_MAX_USER_REQUEST} characters).`,
    );
  }
  return request;
}

export function buildPlanArtifactRequest(input: {
  projectId: string;
  userRequest: string;
  productRequest?: string;
  designIntent: DesignIntentIR | null;
  currentPlan: PlanArtifact | null;
  uiPlan?: UiPlan | null;
  contextSelection: EditContextSelection;
  files: GeneratedFile[];
}): string {
  const request = JSON.stringify({
    userRequest: validatePlanningRequest(input.userRequest),
    productRequest: input.productRequest ?? null,
    designIntent: input.designIntent,
    currentPlan: input.currentPlan,
    uiPlan: input.uiPlan ?? null,
    contextSelection: input.contextSelection,
    project: {
      id: input.projectId,
      files: input.files,
    },
  });
  if (request.length > PLAN_ARTIFACT_MAX_REQUEST_CHARS) {
    throw new Error(
      `Plan Artifact request is too large (max ${PLAN_ARTIFACT_MAX_REQUEST_CHARS} characters).`,
    );
  }
  return request;
}

export async function draftProjectPlan(
  projectInput: string,
  userRequest: string,
  options: DraftProjectPlanOptions = {},
): Promise<PlanArtifactRun> {
  const mode = options.mode ?? 'PLAN';
  const modelClient = options.modelClient ?? defaultModelClient;
  assertModeCapability(mode, 'read-project');
  assertModeCapability(mode, 'search-project');
  assertModeCapability(mode, 'read-plan');
  assertModeCapability(mode, 'write-plan');
  assertModeCapability(mode, 'plan-ui');
  const request = validatePlanningRequest(userRequest);

  const project = await resolveGeneratedProject(projectInput, options.generatedRoot);
  const session = await readProjectSession(project.directory);
  const currentPlan = await readPlanArtifactFromDirectory(project.directory, mode);
  const availableFiles = await listProjectContextFiles(project.directory);
  const initialSelection = await selectProjectContextFiles(
    { userRequest: request, visualSelections: [] },
    availableFiles,
    modelClient,
  );
  const contextSelection = await resolveProjectContextSearch(
    project.directory,
    request,
    availableFiles,
    initialSelection,
  );
  const snapshot = await readProjectSnapshot(project, contextSelection.relevantFiles);

  const uiPlannerRun = await planInterface({
    projectId: project.id,
    userRequest: request,
    productRequest: session?.productRequest,
    designIntent: session?.designIntent ?? null,
    currentUiPlan: currentPlan?.ui ?? null,
    contextSelection,
    files: snapshot.files,
  }, modelClient);
  const uiPlan = uiPlannerRun.result.status === 'PLANNED'
    ? uiPlannerRun.result.plan
    : currentPlan?.ui ?? null;

  const generation = await requestPlanArtifact(
    modelClient,
    buildPlanArtifactRequest({
      projectId: project.id,
      userRequest: request,
      productRequest: session?.productRequest,
      designIntent: session?.designIntent ?? null,
      currentPlan,
      uiPlan,
      contextSelection,
      files: snapshot.files,
    }),
  );
  const content = parsePlanArtifactContent(
    generation.content,
    snapshot.files.map((file) => file.path),
  );
  const now = new Date().toISOString();
  const plan: PlanArtifact = {
    version: PLAN_ARTIFACT_VERSION,
    revision: (currentPlan?.revision ?? 0) + 1,
    status: 'DRAFT',
    ...content,
    ...(uiPlan ? { ui: uiPlan } : {}),
    createdAt: currentPlan?.createdAt ?? now,
    updatedAt: now,
  };
  const persisted = await persistPlanArtifact(project.directory, plan, mode);
  return {
    model: generation.model,
    contextSelection,
    uiPlannerModel: uiPlannerRun.model,
    uiPlanner: uiPlannerRun.result,
    ...persisted,
  };
}

export async function readProjectPlan(
  projectInput: string,
  options: { mode?: YakableMode; generatedRoot?: string } = {},
): Promise<PlanArtifactBundle | null> {
  const mode = options.mode ?? 'BUILD';
  const project = await resolveGeneratedProject(projectInput, options.generatedRoot);
  const plan = await readPlanArtifactFromDirectory(project.directory, mode);
  return plan ? { plan, markdown: renderPlanArtifactMarkdown(plan) } : null;
}

export async function reviewProjectPlan(
  projectInput: string,
  action: PlanReviewAction,
  note?: string,
  options: ReviewProjectPlanOptions = {},
): Promise<PlanArtifactBundle> {
  const mode = options.mode ?? 'PLAN';
  assertModeCapability(mode, 'review-plan');
  assertModeCapability(mode, 'read-plan');
  assertModeCapability(mode, 'write-plan');

  const project = await resolveGeneratedProject(projectInput, options.generatedRoot);
  const current = await readPlanArtifactFromDirectory(project.directory, mode);
  if (!current) throw new Error('No Plan Artifact exists for this project.');
  if (current.status !== 'DRAFT') {
    throw new Error(`Only a DRAFT Plan Artifact can be reviewed; current status is ${current.status}.`);
  }
  if (action !== 'APPROVE' && action !== 'REJECT') {
    throw new Error('Plan review action must be APPROVE or REJECT.');
  }

  const reviewNote = note?.trim();
  if (reviewNote && reviewNote.length > PLAN_ARTIFACT_MAX_REVIEW_NOTE) {
    throw new Error(`Plan review note is too long (max ${PLAN_ARTIFACT_MAX_REVIEW_NOTE} characters).`);
  }
  const now = new Date().toISOString();
  return persistPlanArtifact(
    project.directory,
    {
      ...current,
      status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      updatedAt: now,
      reviewedAt: now,
      ...(reviewNote ? { reviewNote } : {}),
    },
    mode,
  );
}
