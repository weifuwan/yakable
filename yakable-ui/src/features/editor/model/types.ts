import type { PreviewPageObservation } from '@/features/preview/model/preview-page-observation';
import type {
  ProjectConversation,
  ProjectMessageRoute,
  RuntimeProject,
} from '@/features/project/model/types';

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

export interface EditProjectOptions {
  signal?: AbortSignal;
  onRunStarted?: (runId: string) => void;
}

export type EditActivityStatus = 'idle' | 'running' | 'stopping';

export interface EditActivitySnapshot {
  status: EditActivityStatus;
  runId: string | null;
}

export type { ProjectConversation };
