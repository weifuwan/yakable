import type { ContextBudget } from './context-budget.js';

export const CONTEXT_SNAPSHOT_VERSION = 1 as const;

export const CONTEXT_OPERATIONS = ['CREATE', 'EDIT', 'CHAT', 'PLAN'] as const;
export type ContextOperation = (typeof CONTEXT_OPERATIONS)[number];

export const CONTEXT_SECTION_KINDS = [
  'TASK',
  'CONSTRAINTS',
  'PROJECT',
  'CONVERSATION',
  'PLAN',
  'RUNTIME',
  'TOOL',
] as const;
export type ContextSectionKind = (typeof CONTEXT_SECTION_KINDS)[number];

export const CONTEXT_PRIORITIES = [
  'CRITICAL',
  'HIGH',
  'NORMAL',
  'LOW',
  'DISPOSABLE',
] as const;
export type ContextPriority = (typeof CONTEXT_PRIORITIES)[number];

export type ContextJsonPrimitive = string | number | boolean | null;
export type ContextJsonValue =
  | ContextJsonPrimitive
  | readonly ContextJsonValue[]
  | ContextJsonObject;

export interface ContextJsonObject {
  readonly [key: string]: ContextJsonValue;
}

export interface ContextBuildRequest {
  readonly operation: ContextOperation;
  readonly request: string;
  readonly projectInput?: string;
  readonly metadata?: ContextJsonObject;
}

export interface ContextContribution {
  readonly id: string;
  readonly kind: ContextSectionKind;
  readonly priority: ContextPriority;
  readonly pinned?: boolean;
  readonly content: ContextJsonValue;
  readonly metadata?: ContextJsonObject;
}

export interface ContextSection extends ContextContribution {
  readonly source: string;
  readonly pinned: boolean;
}

export interface ContextSnapshot {
  readonly version: typeof CONTEXT_SNAPSHOT_VERSION;
  readonly operation: ContextOperation;
  readonly request: string;
  readonly projectInput?: string;
  readonly metadata?: ContextJsonObject;
  readonly sections: readonly ContextSection[];
  readonly budget: ContextBudget;
  readonly createdAt: string;
}
