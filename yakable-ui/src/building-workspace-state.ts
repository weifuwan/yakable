import type {
  AgentProgressItem,
  AgentProgressState,
} from './protocol/agent-protocol';
import type {
  ProjectCreationStatus,
  ProjectLifecycleStatus,
} from './create-project';

export type BuildStepStatus = 'complete' | 'active' | 'pending' | 'failed';

export interface BuildStepView {
  state: AgentProgressState;
  label: string;
  status: BuildStepStatus;
  message?: string;
}

export interface CreationPreviewCopy {
  eyebrow: string;
  title: string;
  detail: string;
}

const BASE_BUILD_STEPS: ReadonlyArray<{
  state: AgentProgressState;
  label: string;
}> = [
  { state: 'UNDERSTAND', label: 'Understanding your request' },
  { state: 'DESIGN', label: 'Designing the experience' },
  { state: 'TEMPLATE', label: 'Preparing the project' },
  { state: 'GENERATE', label: 'Generating the interface' },
  { state: 'WRITE', label: 'Writing project files' },
  { state: 'CHECK', label: 'Checking the build' },
  { state: 'RUNTIME', label: 'Starting the preview' },
];

function progressItems(creation: ProjectCreationStatus): AgentProgressItem[] {
  return (creation.run?.items ?? []).filter(
    (item): item is AgentProgressItem => item.type === 'progress',
  );
}

function viewStatus(item: AgentProgressItem | undefined): BuildStepStatus {
  if (!item) return 'pending';
  if (item.status === 'FAILED') return 'failed';
  if (item.status === 'ACTIVE') return 'active';
  if (item.status === 'COMPLETED' || item.status === 'SKIPPED') return 'complete';
  return 'pending';
}

function fallbackActiveState(
  lifecycle: ProjectLifecycleStatus,
  steps: BuildStepView[],
): AgentProgressState | null {
  if (lifecycle === 'READY' || lifecycle === 'FAILED') return null;
  if (lifecycle === 'STARTING_RUNTIME') return 'RUNTIME';
  return steps.find((step) => step.status === 'pending')?.state ?? null;
}

export function buildCreationSteps(creation: ProjectCreationStatus): BuildStepView[] {
  const progress = progressItems(creation);
  const latestByState = new Map<AgentProgressState, AgentProgressItem>();
  for (const item of progress) latestByState.set(item.state, item);

  const hasRepair = latestByState.has('REPAIR');
  const definitions = hasRepair
    ? [
        ...BASE_BUILD_STEPS.slice(0, 6),
        { state: 'REPAIR' as const, label: 'Fixing build issues' },
        ...BASE_BUILD_STEPS.slice(6),
      ]
    : [...BASE_BUILD_STEPS];

  const steps = definitions.map<BuildStepView>(({ state, label }) => {
    const item = latestByState.get(state);
    return {
      state,
      label,
      status: viewStatus(item),
      ...(item?.message ? { message: item.message } : {}),
    };
  });

  if (creation.project.status === 'READY') {
    return steps.map((step) =>
      step.status === 'failed' ? step : { ...step, status: 'complete' },
    );
  }

  if (steps.some((step) => step.status === 'active' || step.status === 'failed')) {
    return steps;
  }

  if (creation.project.status === 'FAILED') {
    const failedIndex = Math.max(
      0,
      steps.findIndex((step) => step.status === 'pending'),
    );
    return steps.map((step, index) =>
      index === failedIndex ? { ...step, status: 'failed' } : step,
    );
  }

  const activeState = fallbackActiveState(creation.project.status, steps);
  return steps.map((step) =>
    step.state === activeState ? { ...step, status: 'active' } : step,
  );
}

export function latestCreationMessage(
  creation: ProjectCreationStatus,
): string | undefined {
  const progress = progressItems(creation);
  const active = [...progress].reverse().find((item) => item.status === 'ACTIVE');
  if (active?.message) return active.message;

  const latest = [...progress]
    .reverse()
    .find((item) => item.state !== 'ROUTE' && item.message);
  return latest?.message;
}

export function creationChangedFileCount(creation: ProjectCreationStatus): number {
  const files = new Set<string>();
  for (const item of creation.run?.items ?? []) {
    if (item.type !== 'file_change') continue;
    for (const file of item.files) files.add(file.path);
  }
  return files.size;
}

export function creationPreviewCopy(
  lifecycle: ProjectLifecycleStatus,
  error = '',
): CreationPreviewCopy {
  if (error || lifecycle === 'FAILED') {
    return {
      eyebrow: 'Build paused',
      title: 'Something needs attention',
      detail: error || 'Yakable could not finish this build.',
    };
  }

  if (lifecycle === 'CREATING') {
    return {
      eyebrow: 'Preparing',
      title: 'Setting up your project',
      detail: 'Creating the workspace and getting everything ready to build.',
    };
  }

  if (lifecycle === 'GENERATING') {
    return {
      eyebrow: 'Building',
      title: 'Your app is taking shape',
      detail: 'Yakable is turning your request into a working interface.',
    };
  }

  if (lifecycle === 'STARTING_RUNTIME') {
    return {
      eyebrow: 'Almost there',
      title: 'Starting your preview',
      detail: 'The project is built. Yakable is bringing the preview online.',
    };
  }

  return {
    eyebrow: 'Ready',
    title: 'Opening your preview',
    detail: 'The build is ready and the preview is connecting now.',
  };
}
