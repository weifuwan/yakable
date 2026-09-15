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
  operation: ContextOperation;
  request: string;
  projectInput?: string;
  metadata?: ContextJsonObject;
}

export interface ContextContribution {
  id: string;
  kind: ContextSectionKind;
  priority: ContextPriority;
  pinned?: boolean;
  content: ContextJsonValue;
  metadata?: ContextJsonObject;
}

export interface ContextSection extends ContextContribution {
  source: string;
  pinned: boolean;
}

export interface ContextSnapshot {
  version: typeof CONTEXT_SNAPSHOT_VERSION;
  operation: ContextOperation;
  request: string;
  projectInput?: string;
  metadata?: ContextJsonObject;
  sections: readonly ContextSection[];
  budget: ContextBudget;
  createdAt: string;
}
