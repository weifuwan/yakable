import type { AIProvider } from '../ai/types.js';
import type { PreviewRuntimeSnapshot } from '../runtime/preview-runtime.js';
import { runAgent, type AgentHistoryMessage } from './run-agent.js';

const DEFAULT_MAX_REPAIR_ATTEMPTS = 2;
const MAX_REPAIR_ERROR_LENGTH = 12000;

export interface RuntimeSyncer {
  syncProject(projectId: string): Promise<PreviewRuntimeSnapshot>;
}

export interface AgentRepairSummary {
  attempted: boolean;
  attempts: number;
  succeeded: boolean;
  initialError?: string;
  finalError?: string;
  errors: string[];
  changedFiles: string[];
}

export interface PreviewRepairResult {
  runtime: PreviewRuntimeSnapshot;
  repair: AgentRepairSummary;
}

export interface RepairPreviewOptions {
  history?: AgentHistoryMessage[];
  maxAttempts?: number;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function repairPrompt(error: string, attempt: number) {
  return `[Yakable automatic repair pass ${attempt}]
The controlled Preview Runtime rejected the current generated project.
Inspect the existing source and make the smallest code change that fixes this error. Preserve the user's design and unrelated behavior.

Runtime error:
${error.slice(0, MAX_REPAIR_ERROR_LENGTH)}`;
}

export async function repairPreviewIfNeeded(
  provider: AIProvider,
  runtimeSyncer: RuntimeSyncer,
  projectId: string,
  initialRuntime: PreviewRuntimeSnapshot,
  options: RepairPreviewOptions = {},
): Promise<PreviewRepairResult> {
  const initialError = initialRuntime.status === 'error' ? initialRuntime.error : undefined;
  const maxAttempts = Math.max(
    0,
    Math.min(options.maxAttempts ?? DEFAULT_MAX_REPAIR_ATTEMPTS, DEFAULT_MAX_REPAIR_ATTEMPTS),
  );

  if (!initialError || maxAttempts === 0) {
    return {
      runtime: initialRuntime,
      repair: {
        attempted: false,
        attempts: 0,
        succeeded: initialRuntime.status === 'ready',
        errors: [],
        changedFiles: [],
      },
    };
  }

  let runtime = initialRuntime;
  const errors = [initialError];
  const changedFiles: string[] = [];
  let attempts = 0;

  while (runtime.status === 'error' && runtime.error && attempts < maxAttempts) {
    attempts += 1;
    const currentError = runtime.error;

    try {
      const repairRun = await runAgent(
        provider,
        projectId,
        repairPrompt(currentError, attempts),
        options.history ?? [],
        {
          mode: 'repair',
          runtimeError: currentError,
        },
      );

      changedFiles.push(...repairRun.changedFiles);

      if (repairRun.changedFiles.length === 0) {
        break;
      }

      runtime = await runtimeSyncer.syncProject(projectId);

      if (runtime.status === 'error' && runtime.error) {
        errors.push(runtime.error);
      }
    } catch (error) {
      errors.push(
        `Repair agent failed: ${
          error instanceof Error ? error.message : 'Unknown automatic repair failure'
        }`,
      );
      break;
    }
  }

  return {
    runtime,
    repair: {
      attempted: true,
      attempts,
      succeeded: runtime.status === 'ready',
      initialError,
      finalError: runtime.status === 'error' ? runtime.error : undefined,
      errors,
      changedFiles: unique(changedFiles),
    },
  };
}
