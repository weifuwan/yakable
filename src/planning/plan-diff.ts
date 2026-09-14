import type {
  PlanArtifact,
  PlanArtifactDecision,
  PlanArtifactImplementationStep,
} from './plan-artifact.js';
import type { UiPlan, UiPlanSection } from './ui-planner.js';

export const PLAN_DIFF_VERSION = 1 as const;
export const PLAN_DIFF_MAX_ENTRIES = 96;
export const PLAN_DIFF_MAX_VALUE_LENGTH = 900;

export const PLAN_DIFF_STATUSES = [
  'INITIAL',
  'CHANGED',
  'UNCHANGED',
  'BASELINE_MISSING',
] as const;
export const PLAN_DIFF_AREAS = [
  'goal',
  'context',
  'decisions',
  'ui',
  'implementation',
  'validation',
  'constraints',
  'openQuestions',
] as const;
export const PLAN_DIFF_CHANGE_KINDS = ['ADDED', 'REMOVED', 'CHANGED'] as const;

export type PlanDiffStatus = (typeof PLAN_DIFF_STATUSES)[number];
export type PlanDiffArea = (typeof PLAN_DIFF_AREAS)[number];
export type PlanDiffChangeKind = (typeof PLAN_DIFF_CHANGE_KINDS)[number];

export interface PlanDiffEntry {
  area: PlanDiffArea;
  change: PlanDiffChangeKind;
  path: string;
  before?: string;
  after?: string;
}

export interface PlanDiffSummary {
  added: number;
  removed: number;
  changed: number;
}

export interface PlanDiff {
  version: 1;
  status: PlanDiffStatus;
  fromRevision: number | null;
  toRevision: number;
  summary: PlanDiffSummary;
  entries: PlanDiffEntry[];
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function displayValue(value: string): string {
  const normalized = normalizeText(value);
  return normalized.length <= PLAN_DIFF_MAX_VALUE_LENGTH
    ? normalized
    : `${normalized.slice(0, PLAN_DIFF_MAX_VALUE_LENGTH - 1)}…`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function addEntry(entries: PlanDiffEntry[], entry: PlanDiffEntry): void {
  if (entries.length >= PLAN_DIFF_MAX_ENTRIES) return;
  entries.push({
    ...entry,
    ...(entry.before === undefined ? {} : { before: displayValue(entry.before) }),
    ...(entry.after === undefined ? {} : { after: displayValue(entry.after) }),
  });
}

function compareScalar(
  entries: PlanDiffEntry[],
  area: PlanDiffArea,
  path: string,
  before: string | undefined,
  after: string | undefined,
): void {
  const left = before === undefined ? undefined : normalizeText(before);
  const right = after === undefined ? undefined : normalizeText(after);
  if (left === right) return;
  if (left === undefined) {
    addEntry(entries, { area, change: 'ADDED', path, after: right ?? '' });
    return;
  }
  if (right === undefined) {
    addEntry(entries, { area, change: 'REMOVED', path, before: left });
    return;
  }
  addEntry(entries, { area, change: 'CHANGED', path, before: left, after: right });
}

function compareStringSet(
  entries: PlanDiffEntry[],
  area: PlanDiffArea,
  path: string,
  before: string[],
  after: string[],
): void {
  const left = new Set(before.map(normalizeText));
  const right = new Set(after.map(normalizeText));
  for (const value of left) {
    if (!right.has(value)) addEntry(entries, { area, change: 'REMOVED', path, before: value });
  }
  for (const value of right) {
    if (!left.has(value)) addEntry(entries, { area, change: 'ADDED', path, after: value });
  }
}

function decisionMap(decisions: PlanArtifactDecision[]): Map<string, PlanArtifactDecision> {
  return new Map(decisions.map((item) => [normalizeText(item.decision), item]));
}

function compareDecisions(
  entries: PlanDiffEntry[],
  before: PlanArtifactDecision[],
  after: PlanArtifactDecision[],
): void {
  const left = decisionMap(before);
  const right = decisionMap(after);
  for (const [decision, item] of left) {
    const next = right.get(decision);
    if (!next) {
      addEntry(entries, {
        area: 'decisions',
        change: 'REMOVED',
        path: `decisions:${decision}`,
        before: `${decision} — ${item.reason}`,
      });
      continue;
    }
    compareScalar(
      entries,
      'decisions',
      `decisions:${decision}:reason`,
      item.reason,
      next.reason,
    );
  }
  for (const [decision, item] of right) {
    if (!left.has(decision)) {
      addEntry(entries, {
        area: 'decisions',
        change: 'ADDED',
        path: `decisions:${decision}`,
        after: `${decision} — ${item.reason}`,
      });
    }
  }
}

function implementationMap(
  steps: PlanArtifactImplementationStep[],
): Map<string, PlanArtifactImplementationStep> {
  return new Map(steps.map((item) => [item.id, item]));
}

function compareImplementation(
  entries: PlanDiffEntry[],
  before: PlanArtifactImplementationStep[],
  after: PlanArtifactImplementationStep[],
): void {
  const left = implementationMap(before);
  const right = implementationMap(after);
  for (const [id, step] of left) {
    const next = right.get(id);
    if (!next) {
      addEntry(entries, {
        area: 'implementation',
        change: 'REMOVED',
        path: `implementation:${id}`,
        before: `${step.title} — ${step.purpose}`,
      });
      continue;
    }
    compareScalar(entries, 'implementation', `implementation:${id}:title`, step.title, next.title);
    compareScalar(
      entries,
      'implementation',
      `implementation:${id}:purpose`,
      step.purpose,
      next.purpose,
    );
    compareStringSet(
      entries,
      'implementation',
      `implementation:${id}:files`,
      step.files,
      next.files,
    );
  }
  for (const [id, step] of right) {
    if (!left.has(id)) {
      addEntry(entries, {
        area: 'implementation',
        change: 'ADDED',
        path: `implementation:${id}`,
        after: `${step.title} — ${step.purpose}`,
      });
    }
  }
}

function sectionMap(sections: UiPlanSection[]): Map<string, UiPlanSection> {
  return new Map(sections.map((section) => [section.id, section]));
}

function compareUiSections(entries: PlanDiffEntry[], before: UiPlanSection[], after: UiPlanSection[]): void {
  const left = sectionMap(before);
  const right = sectionMap(after);
  for (const [id, section] of left) {
    const next = right.get(id);
    if (!next) {
      addEntry(entries, {
        area: 'ui',
        change: 'REMOVED',
        path: `ui.sections:${id}`,
        before: `${section.title} · ${section.priority} · ${section.pattern}`,
      });
      continue;
    }
    compareScalar(entries, 'ui', `ui.sections:${id}:title`, section.title, next.title);
    compareScalar(entries, 'ui', `ui.sections:${id}:purpose`, section.purpose, next.purpose);
    compareScalar(entries, 'ui', `ui.sections:${id}:priority`, section.priority, next.priority);
    compareScalar(entries, 'ui', `ui.sections:${id}:pattern`, section.pattern, next.pattern);
    compareStringSet(entries, 'ui', `ui.sections:${id}:content`, section.content, next.content);
  }
  for (const [id, section] of right) {
    if (!left.has(id)) {
      addEntry(entries, {
        area: 'ui',
        change: 'ADDED',
        path: `ui.sections:${id}`,
        after: `${section.title} · ${section.priority} · ${section.pattern}`,
      });
    }
  }
}

function compareUi(entries: PlanDiffEntry[], before: UiPlan | undefined, after: UiPlan | undefined): void {
  if (!before && !after) return;
  if (!before && after) {
    addEntry(entries, {
      area: 'ui',
      change: 'ADDED',
      path: 'ui',
      after: stableJson(after),
    });
    return;
  }
  if (before && !after) {
    addEntry(entries, {
      area: 'ui',
      change: 'REMOVED',
      path: 'ui',
      before: stableJson(before),
    });
    return;
  }
  if (!before || !after) return;

  compareScalar(entries, 'ui', 'ui.scope', before.scope, after.scope);
  compareScalar(entries, 'ui', 'ui.pageType', before.pageType, after.pageType);
  compareScalar(
    entries,
    'ui',
    'ui.shell.navigation',
    before.shell.navigation,
    after.shell.navigation,
  );
  compareScalar(entries, 'ui', 'ui.shell.density', before.shell.density, after.shell.density);
  compareScalar(
    entries,
    'ui',
    'ui.shell.contentWidth',
    before.shell.contentWidth,
    after.shell.contentWidth,
  );
  compareScalar(
    entries,
    'ui',
    'ui.hierarchy.primary',
    before.hierarchy.primary,
    after.hierarchy.primary,
  );
  compareStringSet(
    entries,
    'ui',
    'ui.hierarchy.secondary',
    before.hierarchy.secondary,
    after.hierarchy.secondary,
  );
  compareUiSections(entries, before.sections, after.sections);
  compareStringSet(entries, 'ui', 'ui.responsive', before.responsive, after.responsive);
  compareStringSet(
    entries,
    'ui',
    'ui.deliberateOmissions',
    before.deliberateOmissions,
    after.deliberateOmissions,
  );
}

function countSummary(entries: PlanDiffEntry[]): PlanDiffSummary {
  return entries.reduce<PlanDiffSummary>(
    (summary, entry) => {
      if (entry.change === 'ADDED') summary.added += 1;
      if (entry.change === 'REMOVED') summary.removed += 1;
      if (entry.change === 'CHANGED') summary.changed += 1;
      return summary;
    },
    { added: 0, removed: 0, changed: 0 },
  );
}

export function diffPlanArtifacts(previous: PlanArtifact | null, current: PlanArtifact): PlanDiff {
  if (!previous) {
    return {
      version: PLAN_DIFF_VERSION,
      status: current.revision === 1 ? 'INITIAL' : 'BASELINE_MISSING',
      fromRevision: null,
      toRevision: current.revision,
      summary: { added: 0, removed: 0, changed: 0 },
      entries: [],
    };
  }
  if (previous.revision >= current.revision) {
    throw new Error('Plan Diff requires the previous revision to be older than the current revision.');
  }

  const entries: PlanDiffEntry[] = [];
  compareScalar(entries, 'goal', 'goal', previous.goal, current.goal);
  compareScalar(
    entries,
    'context',
    'context.projectType',
    previous.context.projectType,
    current.context.projectType,
  );
  compareScalar(
    entries,
    'context',
    'context.currentBehavior',
    previous.context.currentBehavior,
    current.context.currentBehavior,
  );
  compareStringSet(
    entries,
    'context',
    'context.relevantFiles',
    previous.context.relevantFiles,
    current.context.relevantFiles,
  );
  compareDecisions(entries, previous.decisions, current.decisions);
  compareUi(entries, previous.ui, current.ui);
  compareImplementation(entries, previous.implementation, current.implementation);
  compareStringSet(entries, 'validation', 'validation', previous.validation, current.validation);
  compareStringSet(entries, 'constraints', 'constraints', previous.constraints, current.constraints);
  compareStringSet(
    entries,
    'openQuestions',
    'openQuestions',
    previous.openQuestions,
    current.openQuestions,
  );

  return {
    version: PLAN_DIFF_VERSION,
    status: entries.length ? 'CHANGED' : 'UNCHANGED',
    fromRevision: previous.revision,
    toRevision: current.revision,
    summary: countSummary(entries),
    entries,
  };
}

function markdownValue(value: string): string {
  return value.replace(/\r?\n+/g, ' ').trim();
}

export function renderPlanDiffMarkdown(diff: PlanDiff): string {
  const from = diff.fromRevision === null ? 'none' : `r${diff.fromRevision}`;
  const header = `> ${from} → r${diff.toRevision} · ${diff.status}`;
  const summary = [
    `- Added: ${diff.summary.added}`,
    `- Removed: ${diff.summary.removed}`,
    `- Changed: ${diff.summary.changed}`,
  ];
  const entries = diff.entries.length
    ? diff.entries.flatMap((entry) => [
        `- **${entry.change}** \`${entry.path}\``,
        ...(entry.before === undefined ? [] : [`  - Before: ${markdownValue(entry.before)}`]),
        ...(entry.after === undefined ? [] : [`  - After: ${markdownValue(entry.after)}`]),
      ])
    : [
        diff.status === 'INITIAL'
          ? '- This is the first Plan revision.'
          : diff.status === 'BASELINE_MISSING'
            ? '- The previous revision is not available in Plan history, so a structural diff cannot be shown.'
            : '- No material Plan fields changed.',
      ];

  return [
    '# Yakable Plan Diff',
    '',
    header,
    '',
    '## Summary',
    '',
    ...summary,
    '',
    '## Changes',
    '',
    ...entries,
    '',
  ].join('\n');
}
