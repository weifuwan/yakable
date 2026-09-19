import type {
  GenerationRun,
  GenerationStep,
  GenerationStepKey,
  GenerationStepStatus,
  GenerationStatus,
} from '../types';

const GENERATION_STATUSES: readonly GenerationStatus[] = [
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
];

const GENERATION_STEP_KEYS: readonly GenerationStepKey[] = [
  'PREPARING',
  'PLANNING',
  'GENERATING',
  'APPLYING',
];

const GENERATION_STEP_STATUSES: readonly GenerationStepStatus[] = [
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
];

function isGenerationStep(value: unknown): value is GenerationStep {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const step = value as Record<string, unknown>;

  return (
    typeof step.key === 'string' &&
    GENERATION_STEP_KEYS.includes(step.key as GenerationStepKey) &&
    typeof step.status === 'string' &&
    GENERATION_STEP_STATUSES.includes(step.status as GenerationStepStatus)
  );
}

function isGenerationRun(value: unknown): value is GenerationRun {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const run = value as Record<string, unknown>;

  return (
    typeof run.id === 'string' &&
    typeof run.projectId === 'string' &&
    typeof run.status === 'string' &&
    GENERATION_STATUSES.includes(run.status as GenerationStatus) &&
    Array.isArray(run.steps) &&
    run.steps.every(isGenerationStep) &&
    typeof run.startedAt === 'string' &&
    typeof run.updatedAt === 'string'
  );
}

export async function ensureGenerationRun(
  projectId: string,
  signal?: AbortSignal,
): Promise<GenerationRun> {
  let response: Response;

  try {
    response = await fetch(
      '/api/projects/' + encodeURIComponent(projectId) + '/generation',
      {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
        },
        signal,
      },
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Unable to start generation.', { cause: error });
  }

  if (!response.ok) {
    throw new Error(
      'Unable to start generation (HTTP ' + response.status + ').',
    );
  }

  let data: unknown;

  try {
    data = await response.json() as unknown;
  } catch (error) {
    throw new Error('Generation API returned invalid JSON.', { cause: error });
  }

  if (!isGenerationRun(data)) {
    throw new Error('Generation API returned an invalid run.');
  }

  return data;
}
