import path from 'node:path';

import type { EditContextSelection } from '../editing/context-selection.js';
import { critiqueDesign, type DesignCriticRun } from '../editing/design-critic.js';
import {
  editGeneratedProject,
  type EditGeneratedProjectOptions,
  type EditProjectResult,
} from '../editing/edit.js';
import type { EditIntentResolution } from '../editing/edit-intent.js';
import {
  repairGeneratedProjectVisual,
  type VisualRepairExecutionResult,
  type VisualRepairResult,
} from '../editing/visual-repair.js';
import {
  isOperationCancelled,
  throwIfOperationCancelled,
} from '../operation-cancellation.js';
import type { AgentProtocolRecorder } from '../protocol/agent-recorder.js';
import type { AgentProtocolItem } from '../protocol/agent-protocol.js';
import { parsePageObservation, type PageObservation } from '../runtime/page-observation.js';
import {
  cancelAgentRun,
  completeAgentRun,
  readAgentRun,
} from '../storage/agent-run.js';
import { readAgentRunTurnDiff, recordAgentRunTurnDiff } from '../storage/agent-run-turn-diff.js';
import {
  deleteAgentRunState,
  readAgentRunState,
  writeAgentRunState,
} from '../storage/agent-run-state.js';
import {
  appendProjectEditHistory,
  readProjectSession,
} from '../projects/project-session.js';
import type { CheckProjectOutput } from '../tools/check-project.js';
import type { ToolResult } from '../tools/tool.js';
import type { ProjectVisualSelection } from '../types.js';
import { TurnDiffTracker } from '../workspace/turn-diff.js';
import { createPersistedAgentRecorder } from './persisted-recorder.js';

export type AgentClientToolName = 'observe_preview';

export interface AgentClientToolRequest {
  toolCallId: string;
  toolName: AgentClientToolName;
  iteration: 0 | 1;
  message: string;
}

export type AgentClientToolResult =
  | {
      toolCallId: string;
      toolName: AgentClientToolName;
      status: 'COMPLETED';
      output: unknown;
    }
  | {
      toolCallId: string;
      toolName: AgentClientToolName;
      status: 'FAILED';
      error: string;
    };

export type UnifiedVisualFeedbackStatus =
  | 'PASS'
  | 'REPAIRED_PASS'
  | 'REPAIRED_FAIL'
  | 'REPAIR_FAILED'
  | 'SKIPPED'
  | 'ERROR';

export interface UnifiedVisualFeedbackResult {
  status: UnifiedVisualFeedbackStatus;
  initialObservation?: PageObservation;
  initialCritique?: DesignCriticRun;
  repair?: VisualRepairResult;
  finalObservation?: PageObservation;
  finalCritique?: DesignCriticRun;
  error?: string;
}

export type UnifiedEditRunStatus = 'WAITING_FOR_CLIENT_TOOL' | 'COMPLETED' | 'FAILED';

export interface UnifiedEditRunResult {
  runId: string;
  status: UnifiedEditRunStatus;
  projectId: string;
  userRequest: string;
  model: string;
  summary: string;
  changedFiles: string[];
  editIntent: EditIntentResolution;
  contextSelection: EditContextSelection;
  projectCheck: ToolResult<CheckProjectOutput>;
  clientTool?: AgentClientToolRequest;
  visualFeedback?: UnifiedVisualFeedbackResult;
}

interface PersistedEditRunState {
  version: 1;
  runId: string;
  projectId: string;
  projectDirectory: string;
  userRequest: string;
  visualSelections: ProjectVisualSelection[];
  model: string;
  summary: string;
  changedFiles: string[];
  editIntent: EditIntentResolution;
  contextSelection: EditContextSelection;
  projectCheck: ToolResult<CheckProjectOutput>;
  iteration: 0 | 1;
  pendingToolCallId: string;
  initialObservation?: PageObservation;
  initialCritique?: DesignCriticRun;
  repair?: VisualRepairResult;
}

type EditRunBaseState = Omit<PersistedEditRunState, 'iteration' | 'pendingToolCallId'>;
type AgentItemListener = (item: AgentProtocolItem) => void;

export interface BeginUnifiedEditRunOptions extends EditGeneratedProjectOptions {
  onItem?: AgentItemListener;
}

export interface ContinueUnifiedEditRunOptions {
  onItem?: AgentItemListener;
}

const STOPPED_BY_USER = 'Stopped by user.';

function healthyProjectCheck(check: ToolResult<CheckProjectOutput>): boolean {
  return check.ok && check.value.status === 'PASS';
}

function mergeChangedFiles(left: string[], right: string[]): string[] {
  return [...new Set([...left, ...right])];
}

function publicRepair(result: VisualRepairExecutionResult): VisualRepairResult {
  const { changeSet: _changeSet, ...repair } = result;
  return repair;
}

function stateFromEdit(edit: EditProjectResult): EditRunBaseState {
  return {
    version: 1,
    runId: edit.agentRunId,
    projectId: edit.projectId,
    projectDirectory: edit.projectDirectory,
    userRequest: edit.userRequest,
    visualSelections: edit.visualSelections,
    model: edit.model,
    summary: edit.summary,
    changedFiles: [...edit.changedFiles],
    editIntent: edit.editIntent,
    contextSelection: edit.contextSelection,
    projectCheck: edit.projectCheck,
  };
}

function resultFromState(
  state: PersistedEditRunState | EditRunBaseState,
  status: UnifiedEditRunStatus,
  extra: Pick<UnifiedEditRunResult, 'clientTool' | 'visualFeedback'> = {},
): UnifiedEditRunResult {
  return {
    runId: state.runId,
    status,
    projectId: state.projectId,
    userRequest: state.userRequest,
    model: state.model,
    summary: state.summary,
    changedFiles: [...state.changedFiles],
    editIntent: state.editIntent,
    contextSelection: state.contextSelection,
    projectCheck: state.projectCheck,
    ...(extra.clientTool ? { clientTool: extra.clientTool } : {}),
    ...(extra.visualFeedback ? { visualFeedback: extra.visualFeedback } : {}),
  };
}

async function persistHistory(state: Pick<
  PersistedEditRunState,
  'projectDirectory' | 'userRequest' | 'summary' | 'changedFiles' | 'model' | 'visualSelections'
>): Promise<void> {
  try {
    await appendProjectEditHistory(state.projectDirectory, {
      userRequest: state.userRequest,
      assistantSummary: state.summary,
      changedFiles: state.changedFiles,
      model: state.model,
      visualSelections: state.visualSelections,
    });
  } catch (error) {
    console.warn('[Yakable Agent] Unified edit history could not be persisted.', error);
  }
}

async function finalizeRun(
  state: PersistedEditRunState | EditRunBaseState,
  status: 'COMPLETED' | 'FAILED',
  feedback: UnifiedVisualFeedbackResult,
  onItem?: AgentItemListener,
): Promise<UnifiedEditRunResult> {
  throwIfOperationCancelled();
  const agent = createPersistedAgentRecorder(state.runId, onItem);
  await persistHistory(state);
  throwIfOperationCancelled();
  agent.message(state.summary);
  agent.progress(
    'DONE',
    status,
    status === 'COMPLETED'
      ? 'Frontend Agent run completed'
      : 'Frontend Agent run stopped before successful completion',
  );
  completeAgentRun(state.runId, {
    model: state.model,
    summary: state.summary,
  });
  deleteAgentRunState(state.runId);
  return resultFromState(state, status, { visualFeedback: feedback });
}

function failActiveProgress(agent: AgentProtocolRecorder, message: string): void {
  const active = [...agent.snapshot()]
    .reverse()
    .find((item) => item.type === 'progress' && item.status === 'ACTIVE');
  if (active?.type === 'progress') {
    agent.progress(active.state, 'FAILED', message, active.iteration);
  }
}

function failActiveToolCall(agent: AgentProtocolRecorder, message: string): void {
  const active = [...agent.snapshot()]
    .reverse()
    .find((item) => item.type === 'tool_call' && item.status === 'ACTIVE');
  if (active?.type === 'tool_call') {
    agent.completeToolCall(active.id, 'FAILED', message, 'Cancelled by user');
  }
}

export function cancelUnifiedEditRun(runId: string, message = STOPPED_BY_USER): boolean {
  const run = readAgentRun(runId);
  if (!run) {
    deleteAgentRunState(runId);
    return false;
  }
  if (run.status !== 'RUNNING') {
    deleteAgentRunState(runId);
    return false;
  }

  const agent = createPersistedAgentRecorder(runId);
  try {
    failActiveToolCall(agent, message);
  } catch {
    // Cancellation must remain best-effort even if the trace is partially written.
  }
  try {
    failActiveProgress(agent, message);
  } catch {
    // Preserve cancellation even if the active progress item cannot be closed.
  }
  try {
    agent.progress('DONE', 'FAILED', message);
  } catch {
    // A run cancelled before its first progress item may not have a valid transition to DONE.
  }

  cancelAgentRun(runId, { summary: message });
  deleteAgentRunState(runId);
  return true;
}

function requestObservation(
  state: EditRunBaseState,
  iteration: 0 | 1,
  onItem?: AgentItemListener,
): UnifiedEditRunResult {
  throwIfOperationCancelled();
  const agent = createPersistedAgentRecorder(state.runId, onItem);
  agent.progress(
    'OBSERVE',
    'ACTIVE',
    iteration === 0 ? 'Waiting for Preview observation' : 'Waiting for repaired Preview observation',
    iteration,
  );
  const toolCall = agent.startToolCall(
    'observe_preview',
    iteration === 0 ? 'Observe the active Preview' : 'Observe the repaired Preview',
    `iteration=${iteration}`,
  );
  const persisted: PersistedEditRunState = {
    ...state,
    iteration,
    pendingToolCallId: toolCall.id,
  };
  writeAgentRunState(state.runId, persisted);
  return resultFromState(persisted, 'WAITING_FOR_CLIENT_TOOL', {
    clientTool: {
      toolCallId: toolCall.id,
      toolName: 'observe_preview',
      iteration,
      message: toolCall.message,
    },
  });
}

export async function beginUnifiedEditRun(
  projectInput: string,
  followUpRequest: string,
  options: BeginUnifiedEditRunOptions = {},
): Promise<UnifiedEditRunResult> {
  throwIfOperationCancelled();
  const onItem = options.onItem ?? options.onEvent;
  const edit = await editGeneratedProject(projectInput, followUpRequest, {
    onRunCreated: options.onRunCreated,
    onEvent: onItem,
  });
  throwIfOperationCancelled();
  const state = stateFromEdit(edit);

  if (!healthyProjectCheck(edit.projectCheck)) {
    return finalizeRun(
      state,
      'FAILED',
      {
        status: 'SKIPPED',
        error: 'Visual feedback skipped because the edited project is not code-healthy.',
      },
      onItem,
    );
  }

  return requestObservation(state, 0, onItem);
}

function validateClientToolResult(
  state: PersistedEditRunState,
  result: AgentClientToolResult,
): void {
  if (result.toolName !== 'observe_preview') {
    throw new Error(`Unsupported client tool result: ${result.toolName}`);
  }
  if (result.toolCallId !== state.pendingToolCallId) {
    throw new Error('Client tool result does not match the pending Agent tool call.');
  }
}

export async function continueUnifiedEditRun(
  runId: string,
  toolResult: AgentClientToolResult,
  options: ContinueUnifiedEditRunOptions = {},
): Promise<UnifiedEditRunResult> {
  throwIfOperationCancelled();
  const state = readAgentRunState<PersistedEditRunState>(runId);
  if (!state || state.version !== 1) {
    throw new Error(`Agent run is not waiting for a client tool result: ${runId}`);
  }
  validateClientToolResult(state, toolResult);

  const agent = createPersistedAgentRecorder(runId, options.onItem);
  if (toolResult.status === 'FAILED') {
    throwIfOperationCancelled();
    agent.completeToolCall(
      state.pendingToolCallId,
      'FAILED',
      `Preview observation failed: ${toolResult.error}`,
      toolResult.error,
    );
    agent.progress('OBSERVE', 'FAILED', `Preview observation failed: ${toolResult.error}`, state.iteration);
    return finalizeRun(
      state,
      'FAILED',
      { status: 'ERROR', error: toolResult.error },
      options.onItem,
    );
  }

  let observation: PageObservation;
  try {
    throwIfOperationCancelled();
    observation = parsePageObservation(toolResult.output);
  } catch (error) {
    if (isOperationCancelled(error)) throw error;
    const message = error instanceof Error ? error.message : String(error);
    agent.completeToolCall(state.pendingToolCallId, 'FAILED', message, 'Invalid page observation');
    agent.progress('OBSERVE', 'FAILED', message, state.iteration);
    return finalizeRun(state, 'FAILED', { status: 'ERROR', error: message }, options.onItem);
  }

  throwIfOperationCancelled();
  agent.completeToolCall(
    state.pendingToolCallId,
    'COMPLETED',
    `Observed ${observation.elements.length} visible key element(s)`,
    `${observation.elements.length} element(s), ${observation.runtimeErrors.length} runtime error(s)`,
  );
  agent.progress(
    'OBSERVE',
    'COMPLETED',
    `Observed ${observation.elements.length} visible key element(s)`,
    state.iteration,
  );

  let failureState: EditRunBaseState = state;
  try {
    throwIfOperationCancelled();
    agent.progress(
      'CRITIQUE',
      'ACTIVE',
      state.iteration === 0
        ? 'Checking the rendered result against design intent'
        : 'Running the final bounded design critique',
      state.iteration,
    );
    const session = await readProjectSession(state.projectDirectory);
    throwIfOperationCancelled();
    const critique = await critiqueDesign({
      baselineDesignIntent: session?.designIntent ?? null,
      editIntent: state.editIntent.delta,
      pageObservation: observation,
    });
    throwIfOperationCancelled();
    agent.progress(
      'CRITIQUE',
      'COMPLETED',
      critique.result.status === 'PASS'
        ? 'No concrete observable mismatch was found'
        : `Found ${critique.result.findings.length} grounded design issue(s)`,
      state.iteration,
    );

    if (state.iteration === 1) {
      return finalizeRun(
        state,
        'COMPLETED',
        {
          status: critique.result.status === 'PASS' ? 'REPAIRED_PASS' : 'REPAIRED_FAIL',
          ...(state.initialObservation ? { initialObservation: state.initialObservation } : {}),
          ...(state.initialCritique ? { initialCritique: state.initialCritique } : {}),
          ...(state.repair ? { repair: state.repair } : {}),
          finalObservation: observation,
          finalCritique: critique,
        },
        options.onItem,
      );
    }

    if (critique.result.status === 'PASS') {
      return finalizeRun(
        state,
        'COMPLETED',
        {
          status: 'PASS',
          initialObservation: observation,
          initialCritique: critique,
        },
        options.onItem,
      );
    }

    throwIfOperationCancelled();
    agent.progress('REPAIR', 'ACTIVE', 'Applying one bounded visual repair');
    const repairExecution = await repairGeneratedProjectVisual(
      state.projectDirectory,
      {
        userRequest: state.userRequest,
        baselineDesignIntent: session?.designIntent ?? null,
        editIntent: state.editIntent.delta,
        critique: critique.result,
        pageObservation: observation,
        initialChangedFiles: state.changedFiles,
        selectedContextFiles: state.contextSelection.relevantFiles,
      },
      {
        generatedRoot: path.dirname(state.projectDirectory),
        agent,
      },
    );
    throwIfOperationCancelled();
    const repair = publicRepair(repairExecution);

    if (
      repairExecution.status !== 'REPAIRED'
      || !repairExecution.changeSet
      || !repairExecution.projectCheck
      || !healthyProjectCheck(repairExecution.projectCheck)
    ) {
      agent.progress(
        'REPAIR',
        'FAILED',
        repairExecution.rolledBack
          ? 'Visual repair failed project health checks and was rolled back'
          : repairExecution.error || 'Visual repair did not produce a healthy project',
      );
      return finalizeRun(
        state,
        'FAILED',
        {
          status: 'REPAIR_FAILED',
          initialObservation: observation,
          initialCritique: critique,
          repair,
          ...(repair.error ? { error: repair.error } : {}),
        },
        options.onItem,
      );
    }

    const repairedState: EditRunBaseState = {
      ...state,
      changedFiles: mergeChangedFiles(state.changedFiles, repairExecution.changedFiles),
      initialObservation: observation,
      initialCritique: critique,
      repair,
    };
    failureState = repairedState;

    throwIfOperationCancelled();
    const turnDiff = new TurnDiffTracker(readAgentRunTurnDiff(runId));
    turnDiff.record(repairExecution.changeSet);
    recordAgentRunTurnDiff(runId, await turnDiff.snapshot());
    throwIfOperationCancelled();

    agent.progress('REPAIR', 'COMPLETED', 'Applied one code-healthy visual repair');
    return requestObservation(repairedState, 1, options.onItem);
  } catch (error) {
    if (isOperationCancelled(error)) throw error;
    const message = error instanceof Error ? error.message : String(error);
    try {
      failActiveProgress(agent, `Frontend feedback failed: ${message}`);
    } catch {
      // Preserve the original continuation error if the progress stream cannot be closed cleanly.
    }
    return finalizeRun(
      failureState,
      'FAILED',
      {
        status: 'ERROR',
        ...(state.iteration === 0 ? { initialObservation: observation } : {}),
        ...(state.initialObservation ? { initialObservation: state.initialObservation } : {}),
        ...(state.initialCritique ? { initialCritique: state.initialCritique } : {}),
        ...(state.repair ? { repair: state.repair } : {}),
        error: message,
      },
      options.onItem,
    );
  }
}
