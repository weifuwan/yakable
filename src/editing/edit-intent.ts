import { requestEditIntentDelta } from '../model/deepseek.js';
import type { DesignIntentIR, ProjectVisualSelection } from '../types.js';

export const EDIT_INTENT_VERSION = 1 as const;
export const MAX_EDIT_INTENT_PROMPT_LENGTH = 8_000;
export const MAX_EDIT_INTENT_DIRECTIVES = 12;
export const MAX_EDIT_INTENT_TARGET_HINTS = 8;
export const MAX_EDIT_INTENT_PRESERVE = 8;
const MAX_EDIT_INTENT_SUMMARY_LENGTH = 400;
const MAX_EDIT_INTENT_DIRECTIVE_LENGTH = 400;
const MAX_EDIT_INTENT_TARGET_HINT_LENGTH = 160;
const MAX_EDIT_INTENT_PRESERVE_LENGTH = 240;
const MAX_VISUAL_SELECTIONS = 20;

export type EditIntentScope = 'selection' | 'component' | 'section' | 'page' | 'project';

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

export type EditIntentDirectiveBasis = 'explicit' | 'interpreted';
export type EditIntentResolutionSource = 'model' | 'fallback';

export interface EditIntentDirective {
  area: EditIntentArea;
  directive: string;
  basis: EditIntentDirectiveBasis;
}

export interface EditIntentDelta {
  version: 1;
  summary: string;
  scope: EditIntentScope;
  targetHints: string[];
  directives: EditIntentDirective[];
  preserve: string[];
}

export interface EditIntentDeltaInput {
  userRequest: string;
  baselineDesignIntent: DesignIntentIR | null;
  visualSelections: ProjectVisualSelection[];
}

export interface EditIntentResolution {
  delta: EditIntentDelta;
  source: EditIntentResolutionSource;
  reason: string;
}

const SCOPES = new Set<EditIntentScope>([
  'selection',
  'component',
  'section',
  'page',
  'project',
]);

const AREAS = new Set<EditIntentArea>([
  'content',
  'visual-hierarchy',
  'composition',
  'typography',
  'color',
  'spacing-density',
  'surface-treatment',
  'imagery',
  'motion',
  'interaction',
  'responsive',
  'navigation',
  'component-expression',
]);

const BASES = new Set<EditIntentDirectiveBasis>(['explicit', 'interpreted']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readEnum<T extends string>(value: unknown, field: string, allowed: Set<T>): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    throw new Error(`Edit Intent Delta returned an invalid ${field}.`);
  }
  return value as T;
}

function readRequiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new Error(`Edit Intent Delta returned an invalid ${field}.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`Edit Intent Delta returned an invalid ${field}.`);
  }
  return normalized;
}

function readStringArray(
  value: unknown,
  field: string,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`Edit Intent Delta returned an invalid ${field}.`);
  }

  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of value) {
    const normalized = readRequiredString(item, `${field} item`, maxLength);
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(normalized);
  }
  return items;
}

function readDirectives(value: unknown): EditIntentDirective[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_EDIT_INTENT_DIRECTIVES) {
    throw new Error(
      `Edit Intent Delta directives must contain 1-${MAX_EDIT_INTENT_DIRECTIVES} items.`,
    );
  }

  const directives: EditIntentDirective[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!isRecord(item)) {
      throw new Error('Edit Intent Delta returned an invalid directive.');
    }
    const area = readEnum(item.area, 'directive area', AREAS);
    const directive = readRequiredString(
      item.directive,
      'directive text',
      MAX_EDIT_INTENT_DIRECTIVE_LENGTH,
    );
    const basis = readEnum(item.basis, 'directive basis', BASES);
    const key = `${area}:${directive.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    directives.push({ area, directive, basis });
  }

  if (directives.length === 0) {
    throw new Error('Edit Intent Delta must contain at least one unique directive.');
  }
  return directives;
}

export function parseEditIntentDelta(rawContent: string): EditIntentDelta {
  let value: unknown;
  try {
    value = JSON.parse(rawContent);
  } catch {
    throw new Error('Edit Intent Delta output was not valid JSON.');
  }

  if (!isRecord(value) || value.version !== EDIT_INTENT_VERSION) {
    throw new Error('Edit Intent Delta output must be a version 1 object.');
  }

  return {
    version: EDIT_INTENT_VERSION,
    summary: readRequiredString(value.summary, 'summary', MAX_EDIT_INTENT_SUMMARY_LENGTH),
    scope: readEnum(value.scope, 'scope', SCOPES),
    targetHints: readStringArray(
      value.targetHints,
      'targetHints',
      MAX_EDIT_INTENT_TARGET_HINTS,
      MAX_EDIT_INTENT_TARGET_HINT_LENGTH,
    ),
    directives: readDirectives(value.directives),
    preserve: readStringArray(
      value.preserve,
      'preserve',
      MAX_EDIT_INTENT_PRESERVE,
      MAX_EDIT_INTENT_PRESERVE_LENGTH,
    ),
  };
}

export function buildEditIntentDeltaRequest(input: EditIntentDeltaInput): string {
  const userRequest = input.userRequest.trim();
  if (!userRequest) {
    throw new Error('Edit Intent Delta requires a follow-up edit request.');
  }
  if (userRequest.length > MAX_EDIT_INTENT_PROMPT_LENGTH) {
    throw new Error(
      `Edit Intent Delta accepts at most ${MAX_EDIT_INTENT_PROMPT_LENGTH} characters.`,
    );
  }

  const visualSelections = input.visualSelections.slice(0, MAX_VISUAL_SELECTIONS).map((selection) => ({
    ...(selection.sourceId ? { sourceId: selection.sourceId } : {}),
    ...(selection.file ? { file: selection.file } : {}),
    ...(selection.line ? { line: selection.line } : {}),
    ...(selection.column ? { column: selection.column } : {}),
    tagName: selection.tagName,
    text: selection.text,
    selector: selection.selector,
  }));

  return JSON.stringify({
    userRequest,
    baselineDesignIntent: input.baselineDesignIntent,
    visualSelections,
  });
}

function fallbackScope(request: string, visualSelections: ProjectVisualSelection[]): EditIntentScope {
  if (visualSelections.length > 0) return 'selection';
  if (/(全局|整个项目|全站|所有页面|global|project-wide|site-wide|everywhere)/i.test(request)) {
    return 'project';
  }
  if (/(整个页面|全页|当前页面|whole page|entire page|page-wide)/i.test(request)) {
    return 'page';
  }
  if (/(hero|pricing|header|footer|section|区域|区块|页头|页脚|导航栏)/i.test(request)) {
    return 'section';
  }
  return 'component';
}

function fallbackArea(request: string): EditIntentArea {
  if (/(文案|文字|标题|描述|copy|text|label|wording|title)/i.test(request)) return 'content';
  if (/(层级|主次|hierarchy|emphasis|重点)/i.test(request)) return 'visual-hierarchy';
  if (/(布局|构图|排列|layout|composition|grid|columns?)/i.test(request)) return 'composition';
  if (/(字体|字号|字重|行高|排版|font|typography|line-height)/i.test(request)) return 'typography';
  if (/(颜色|配色|主色|color|colour|palette|theme)/i.test(request)) return 'color';
  if (/(间距|留白|密度|padding|margin|spacing|density|gap)/i.test(request)) return 'spacing-density';
  if (/(圆角|阴影|边框|卡片|表面|radius|shadow|border|surface|card)/i.test(request)) {
    return 'surface-treatment';
  }
  if (/(图片|插图|图像|image|illustration|photo|icon)/i.test(request)) return 'imagery';
  if (/(动画|动效|过渡|motion|animation|transition)/i.test(request)) return 'motion';
  if (/(点击|交互|悬停|hover|click|interaction|disabled|loading)/i.test(request)) return 'interaction';
  if (/(响应式|手机|移动端|平板|responsive|mobile|tablet|breakpoint)/i.test(request)) {
    return 'responsive';
  }
  if (/(导航|路由|跳转|navigation|route|link)/i.test(request)) return 'navigation';
  return 'component-expression';
}

function fallbackTargetHints(visualSelections: ProjectVisualSelection[]): string[] {
  const hints: string[] = [];
  for (const selection of visualSelections) {
    const text = selection.text.trim().replace(/\s+/g, ' ').slice(0, 80);
    const hint = text ? `${selection.tagName}: ${text}` : selection.tagName;
    if (!hints.includes(hint)) hints.push(hint);
    if (hints.length >= MAX_EDIT_INTENT_TARGET_HINTS) break;
  }
  return hints;
}

export function fallbackEditIntentDelta(
  userRequest: string,
  visualSelections: ProjectVisualSelection[] = [],
): EditIntentDelta {
  const request = userRequest.trim();
  if (!request) {
    throw new Error('Edit Intent Delta requires a follow-up edit request.');
  }
  const directive = request.slice(0, MAX_EDIT_INTENT_DIRECTIVE_LENGTH);
  return {
    version: EDIT_INTENT_VERSION,
    summary: request.slice(0, MAX_EDIT_INTENT_SUMMARY_LENGTH),
    scope: fallbackScope(request, visualSelections),
    targetHints: fallbackTargetHints(visualSelections),
    directives: [
      {
        area: fallbackArea(request),
        directive,
        basis: 'explicit',
      },
    ],
    preserve: [],
  };
}

export async function resolveEditIntentDelta(
  input: EditIntentDeltaInput,
): Promise<EditIntentResolution> {
  try {
    const generation = await requestEditIntentDelta(buildEditIntentDeltaRequest(input));
    return {
      delta: parseEditIntentDelta(generation.content),
      source: 'model',
      reason: 'Normalized the current follow-up request against the project Design Intent.',
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      delta: fallbackEditIntentDelta(input.userRequest, input.visualSelections),
      source: 'fallback',
      reason: `Edit Intent fallback used after normalization failed: ${reason}`.slice(0, 400),
    };
  }
}
