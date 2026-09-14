import type { EditContextSelection } from '../editing/context-selection.js';
import {
  assertModeCapability,
  type YakableMode,
} from '../modes/mode-contract.js';
import { requestUiPlan } from '../model/deepseek.js';
import type { DesignIntentIR, GeneratedFile } from '../types.js';

export const UI_PLAN_VERSION = 1 as const;
export const UI_PLANNER_RESULT_VERSION = 1 as const;
export const UI_PLAN_MAX_SECTIONS = 10;
export const UI_PLAN_MAX_SECONDARY_HIERARCHY = 6;
export const UI_PLAN_MAX_SECTION_CONTENT = 8;
export const UI_PLAN_MAX_RESPONSIVE_ITEMS = 10;
export const UI_PLAN_MAX_OMISSIONS = 10;
export const UI_PLANNER_MAX_CONTEXT_FILES = 12;
export const UI_PLANNER_MAX_USER_REQUEST = 8_000;
export const UI_PLANNER_MAX_REQUEST_CHARS = 900_000;
const UI_PLAN_MAX_SHORT_TEXT = 240;
const UI_PLAN_MAX_TEXT = 900;

export const UI_PLAN_SCOPES = ['PAGE', 'PROJECT'] as const;
export const UI_PLAN_NAVIGATION = ['NONE', 'TOP', 'SIDEBAR', 'MIXED'] as const;
export const UI_PLAN_DENSITIES = ['COMPACT', 'COMFORTABLE', 'SPACIOUS'] as const;
export const UI_PLAN_CONTENT_WIDTHS = ['NARROW', 'CONTAINED', 'FLUID'] as const;
export const UI_PLAN_PRIORITIES = ['PRIMARY', 'SECONDARY'] as const;
export const UI_PLAN_PATTERNS = [
  'HERO',
  'STATS',
  'TABLE',
  'FORM',
  'LIST',
  'CARD_GRID',
  'DETAIL',
  'TOOLBAR',
  'NAVIGATION',
  'CUSTOM',
] as const;
export const UI_PLANNER_STATUSES = ['PLANNED', 'NOT_APPLICABLE'] as const;

export type UiPlanScope = (typeof UI_PLAN_SCOPES)[number];
export type UiPlanNavigation = (typeof UI_PLAN_NAVIGATION)[number];
export type UiPlanDensity = (typeof UI_PLAN_DENSITIES)[number];
export type UiPlanContentWidth = (typeof UI_PLAN_CONTENT_WIDTHS)[number];
export type UiPlanPriority = (typeof UI_PLAN_PRIORITIES)[number];
export type UiPlanPattern = (typeof UI_PLAN_PATTERNS)[number];
export type UiPlannerStatus = (typeof UI_PLANNER_STATUSES)[number];

export interface UiPlanShell {
  navigation: UiPlanNavigation;
  density: UiPlanDensity;
  contentWidth: UiPlanContentWidth;
}

export interface UiPlanHierarchy {
  primary: string;
  secondary: string[];
}

export interface UiPlanSection {
  id: string;
  title: string;
  purpose: string;
  priority: UiPlanPriority;
  pattern: UiPlanPattern;
  content: string[];
}

export interface UiPlan {
  version: 1;
  scope: UiPlanScope;
  pageType: string;
  shell: UiPlanShell;
  hierarchy: UiPlanHierarchy;
  sections: UiPlanSection[];
  responsive: string[];
  deliberateOmissions: string[];
}

export type UiPlannerResult =
  | {
      version: 1;
      status: 'PLANNED';
      reason: string;
      plan: UiPlan;
    }
  | {
      version: 1;
      status: 'NOT_APPLICABLE';
      reason: string;
    };

export interface UiPlannerInput {
  mode?: YakableMode;
  projectId: string;
  userRequest: string;
  productRequest?: string;
  designIntent: DesignIntentIR | null;
  currentUiPlan: UiPlan | null;
  contextSelection: EditContextSelection;
  files: GeneratedFile[];
}

export interface UiPlannerRun {
  model: string;
  result: UiPlannerResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, field: string, maxLength = UI_PLAN_MAX_TEXT): string {
  if (typeof value !== 'string') {
    throw new Error(`UI Planner ${field} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`UI Planner ${field} must contain 1-${maxLength} characters.`);
  }
  return normalized;
}

function readEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`UI Planner ${field} has an invalid value.`);
  }
  return value as T;
}

function readStringArray(
  value: unknown,
  field: string,
  maxItems: number,
  maxLength = UI_PLAN_MAX_TEXT,
): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`UI Planner ${field} must contain at most ${maxItems} items.`);
  }
  const items: string[] = [];
  for (const [index, item] of value.entries()) {
    const text = readString(item, `${field}[${index}]`, maxLength);
    if (!items.includes(text)) items.push(text);
  }
  return items;
}

function readSections(value: unknown): UiPlanSection[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > UI_PLAN_MAX_SECTIONS) {
    throw new Error(`UI Planner sections must contain 1-${UI_PLAN_MAX_SECTIONS} items.`);
  }

  const ids = new Set<string>();
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`UI Planner sections[${index}] must be an object.`);
    const id = readString(item.id, `sections[${index}].id`, 80);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) || ids.has(id)) {
      throw new Error(`UI Planner sections[${index}].id must be unique and stable.`);
    }
    ids.add(id);
    return {
      id,
      title: readString(item.title, `sections[${index}].title`, UI_PLAN_MAX_SHORT_TEXT),
      purpose: readString(item.purpose, `sections[${index}].purpose`),
      priority: readEnum(item.priority, `sections[${index}].priority`, UI_PLAN_PRIORITIES),
      pattern: readEnum(item.pattern, `sections[${index}].pattern`, UI_PLAN_PATTERNS),
      content: readStringArray(
        item.content,
        `sections[${index}].content`,
        UI_PLAN_MAX_SECTION_CONTENT,
        500,
      ),
    };
  });
}

export function parseUiPlanValue(value: unknown): UiPlan {
  if (!isRecord(value) || value.version !== UI_PLAN_VERSION) {
    throw new Error('UI Plan must be a version 1 object.');
  }
  if (!isRecord(value.shell) || !isRecord(value.hierarchy)) {
    throw new Error('UI Plan must contain shell and hierarchy objects.');
  }

  return {
    version: UI_PLAN_VERSION,
    scope: readEnum(value.scope, 'scope', UI_PLAN_SCOPES),
    pageType: readString(value.pageType, 'pageType', UI_PLAN_MAX_SHORT_TEXT),
    shell: {
      navigation: readEnum(value.shell.navigation, 'shell.navigation', UI_PLAN_NAVIGATION),
      density: readEnum(value.shell.density, 'shell.density', UI_PLAN_DENSITIES),
      contentWidth: readEnum(
        value.shell.contentWidth,
        'shell.contentWidth',
        UI_PLAN_CONTENT_WIDTHS,
      ),
    },
    hierarchy: {
      primary: readString(value.hierarchy.primary, 'hierarchy.primary'),
      secondary: readStringArray(
        value.hierarchy.secondary,
        'hierarchy.secondary',
        UI_PLAN_MAX_SECONDARY_HIERARCHY,
        500,
      ),
    },
    sections: readSections(value.sections),
    responsive: readStringArray(
      value.responsive,
      'responsive',
      UI_PLAN_MAX_RESPONSIVE_ITEMS,
      700,
    ),
    deliberateOmissions: readStringArray(
      value.deliberateOmissions,
      'deliberateOmissions',
      UI_PLAN_MAX_OMISSIONS,
      700,
    ),
  };
}

export function parseUiPlannerResult(rawContent: string): UiPlannerResult {
  let value: unknown;
  try {
    value = JSON.parse(rawContent);
  } catch {
    throw new Error('UI Planner output was not valid JSON.');
  }
  if (!isRecord(value) || value.version !== UI_PLANNER_RESULT_VERSION) {
    throw new Error('UI Planner output must be a version 1 object.');
  }

  const status = readEnum(value.status, 'status', UI_PLANNER_STATUSES);
  const reason = readString(value.reason, 'reason', 700);
  if (status === 'NOT_APPLICABLE') {
    if (value.plan !== undefined && value.plan !== null) {
      throw new Error('UI Planner NOT_APPLICABLE output cannot contain a plan.');
    }
    return { version: UI_PLANNER_RESULT_VERSION, status, reason };
  }

  if (value.plan === undefined) {
    throw new Error('UI Planner PLANNED output must contain a plan.');
  }
  return {
    version: UI_PLANNER_RESULT_VERSION,
    status,
    reason,
    plan: parseUiPlanValue(value.plan),
  };
}

function validateRequestContext(input: UiPlannerInput): string {
  const request = input.userRequest.trim();
  if (!request) throw new Error('UI Planner requires a user request.');
  if (request.length > UI_PLANNER_MAX_USER_REQUEST) {
    throw new Error(
      `UI Planner user request is too long (max ${UI_PLANNER_MAX_USER_REQUEST} characters).`,
    );
  }
  if (input.files.length === 0 || input.files.length > UI_PLANNER_MAX_CONTEXT_FILES) {
    throw new Error(
      `UI Planner requires 1-${UI_PLANNER_MAX_CONTEXT_FILES} bounded context files.`,
    );
  }

  const selected = new Set(input.contextSelection.relevantFiles);
  const seen = new Set<string>();
  for (const file of input.files) {
    const filePath = file.path.trim();
    if (!filePath || seen.has(filePath)) {
      throw new Error('UI Planner context files must have unique non-empty paths.');
    }
    if (!selected.has(filePath)) {
      throw new Error(`UI Planner received a file outside selected context: ${filePath}.`);
    }
    seen.add(filePath);
  }
  return request;
}

export function buildUiPlannerRequest(input: UiPlannerInput): string {
  const userRequest = validateRequestContext(input);
  const request = JSON.stringify({
    userRequest,
    productRequest: input.productRequest ?? null,
    designIntent: input.designIntent,
    currentUiPlan: input.currentUiPlan,
    contextSelection: input.contextSelection,
    project: {
      id: input.projectId,
      files: input.files,
    },
  });

  if (request.length > UI_PLANNER_MAX_REQUEST_CHARS) {
    throw new Error(
      `UI Planner request is too large (max ${UI_PLANNER_MAX_REQUEST_CHARS} characters).`,
    );
  }
  return request;
}

export async function planInterface(input: UiPlannerInput): Promise<UiPlannerRun> {
  const mode = input.mode ?? 'PLAN';
  assertModeCapability(mode, 'plan-ui');
  const generation = await requestUiPlan(buildUiPlannerRequest(input));
  return {
    model: generation.model,
    result: parseUiPlannerResult(generation.content),
  };
}
