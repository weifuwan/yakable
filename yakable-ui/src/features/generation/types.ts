export type GenerationStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export type GenerationStepKey =
  | 'PREPARING'
  | 'PLANNING'
  | 'GENERATING'
  | 'APPLYING';

export type GenerationStepStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED';

export interface GenerationStep {
  key: GenerationStepKey;
  status: GenerationStepStatus;
}

export interface GenerationRun {
  id: string;
  projectId: string;
  status: GenerationStatus;
  steps: GenerationStep[];
  startedAt: string;
  updatedAt: string;
}
