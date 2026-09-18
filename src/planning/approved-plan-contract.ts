import { createHash } from 'node:crypto';

import type {
  PlanArtifact,
  PlanArtifactContext,
  PlanArtifactDecision,
  PlanArtifactImplementationStep,
} from './plan-artifact.js';
import type { UiPlan } from './ui-planner.js';

export const APPROVED_PLAN_EXECUTION_VERSION = 1 as const;
export const APPROVED_PLAN_MAX_CONTEXT_HINTS = 12;
export const APPROVED_PLAN_MAX_DEVIATIONS = 8;

export type ApprovedPlanExecutionErrorCode =
  | 'APPROVED_PLAN_NOT_FOUND'
  | 'APPROVED_PLAN_REQUIRED'
  | 'APPROVED_PLAN_REVIEW_REQUIRED'
  | 'APPROVED_PLAN_OPEN_QUESTIONS'
  | 'APPROVED_PLAN_IMPLEMENTATION_REQUIRED'
  | 'APPROVED_PLAN_BUILD_BLOCKED';

export class ApprovedPlanExecutionError extends Error {
  readonly code: ApprovedPlanExecutionErrorCode;
  readonly deviations: string[];

  constructor(
    code: ApprovedPlanExecutionErrorCode,
    message: string,
    deviations: string[] = [],
  ) {
    super(message);
    this.name = 'ApprovedPlanExecutionError';
    this.code = code;
    this.deviations = deviations;
  }
}

export interface ApprovedPlanExecutionSource {
  revision: number;
  fingerprint: string;
  approvedAt: string;
  reviewNote?: string;
}

export interface ApprovedPlanExecutionContract {
  version: 1;
  source: ApprovedPlanExecutionSource;
  goal: string;
  context: PlanArtifactContext;
  decisions: PlanArtifactDecision[];
  ui?: UiPlan;
  implementation: PlanArtifactImplementationStep[];
  validation: string[];
  constraints: string[];
}

function cloneStrings(values: string[]): string[] {
  return values.map((value) => value);
}

function fingerprintPlan(plan: PlanArtifact): string {
  return createHash('sha256').update(JSON.stringify(plan)).digest('hex').slice(0, 24);
}

export function compileApprovedPlanExecutionContract(
  plan: PlanArtifact,
): ApprovedPlanExecutionContract {
  if (plan.status !== 'APPROVED') {
    throw new ApprovedPlanExecutionError(
      'APPROVED_PLAN_REQUIRED',
      `Build From Approved Plan requires an APPROVED Plan Artifact; current status is ${plan.status}.`,
    );
  }
  if (!plan.reviewedAt) {
    throw new ApprovedPlanExecutionError(
      'APPROVED_PLAN_REVIEW_REQUIRED',
      'Approved Plan Artifact is missing reviewedAt; approve the current draft through the review flow before Build.',
    );
  }
  if (plan.openQuestions.length > 0) {
    throw new ApprovedPlanExecutionError(
      'APPROVED_PLAN_OPEN_QUESTIONS',
      'Approved Plan Artifact still contains blocking open questions. Revise and re-approve the plan before Build.',
      plan.openQuestions.slice(0, APPROVED_PLAN_MAX_DEVIATIONS),
    );
  }
  if (plan.implementation.length === 0) {
    throw new ApprovedPlanExecutionError(
      'APPROVED_PLAN_IMPLEMENTATION_REQUIRED',
      'Approved Plan Artifact has no implementation steps to execute.',
    );
  }

  return {
    version: APPROVED_PLAN_EXECUTION_VERSION,
    source: {
      revision: plan.revision,
      fingerprint: fingerprintPlan(plan),
      approvedAt: plan.reviewedAt,
      ...(plan.reviewNote ? { reviewNote: plan.reviewNote } : {}),
    },
    goal: plan.goal,
    context: {
      projectType: plan.context.projectType,
      relevantFiles: cloneStrings(plan.context.relevantFiles),
      ...(plan.context.currentBehavior
        ? { currentBehavior: plan.context.currentBehavior }
        : {}),
    },
    decisions: plan.decisions.map((item) => ({ ...item })),
    ...(plan.ui ? { ui: structuredClone(plan.ui) } : {}),
    implementation: plan.implementation.map((step) => ({
      ...step,
      files: cloneStrings(step.files),
    })),
    validation: cloneStrings(plan.validation),
    constraints: cloneStrings(plan.constraints),
  };
}

export function collectApprovedPlanContextHints(
  contract: ApprovedPlanExecutionContract,
  availableFiles: string[],
): string[] {
  const available = new Set(availableFiles.map((file) => file.trim()).filter(Boolean));
  const selected: string[] = [];
  const add = (file: string) => {
    const normalized = file.trim();
    if (
      normalized
      && available.has(normalized)
      && !selected.includes(normalized)
      && selected.length < APPROVED_PLAN_MAX_CONTEXT_HINTS
    ) {
      selected.push(normalized);
    }
  };

  for (const file of contract.context.relevantFiles) add(file);
  for (const step of contract.implementation) {
    for (const file of step.files) add(file);
  }
  return selected;
}

export function buildApprovedPlanExecutionRequest(
  contract: ApprovedPlanExecutionContract,
): string {
  const decisions = contract.decisions.map((item) => item.decision).join('; ');
  const steps = contract.implementation.map((step) => step.title).join('; ');
  const constraints = contract.constraints.join('; ');
  const uiSummary = contract.ui
    ? ` UI blueprint: ${contract.ui.pageType}; primary hierarchy: ${contract.ui.hierarchy.primary}; sections: ${contract.ui.sections.map((section) => section.title).join(', ')}.`
    : '';

  return [
    `Execute approved Yakable Plan revision ${contract.source.revision}.`,
    `Goal: ${contract.goal}.`,
    decisions ? `Approved decisions: ${decisions}.` : '',
    steps ? `Implementation steps: ${steps}.` : '',
    constraints ? `Constraints: ${constraints}.` : '',
    uiSummary,
    'Do not re-plan or substitute a different product/UI direction.',
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 7_800);
}
