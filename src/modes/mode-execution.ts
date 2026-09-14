import {
  editGeneratedProject,
  type EditGeneratedProjectOptions,
  type EditProjectResult,
} from '../editing/edit.js';
import {
  repairGeneratedProjectVisual,
  type VisualRepairProjectInput,
  type VisualRepairResult,
} from '../editing/visual-repair.js';
import {
  generateProject,
  type GenerateProjectOptions,
} from '../generation/generate.js';
import type { GenerationResult } from '../types.js';
import {
  assertModeCapability,
  type YakableMode,
  type YakableModeCapability,
} from './mode-contract.js';

export async function runModeCapability<T>(
  mode: YakableMode,
  capability: YakableModeCapability,
  task: () => Promise<T>,
): Promise<T> {
  assertModeCapability(mode, capability);
  return task();
}

export function generateProjectInMode(
  mode: YakableMode,
  prompt: string,
  options: Omit<GenerateProjectOptions, 'mode'> = {},
): Promise<GenerationResult> {
  return runModeCapability(mode, 'generate-source', () =>
    generateProject(prompt, { ...options, mode }),
  );
}

export function editGeneratedProjectInMode(
  mode: YakableMode,
  projectInput: string,
  followUpRequest: string,
  options: EditGeneratedProjectOptions = {},
): Promise<EditProjectResult> {
  return runModeCapability(mode, 'edit-source', () =>
    editGeneratedProject(projectInput, followUpRequest, options),
  );
}

export function repairGeneratedProjectVisualInMode(
  mode: YakableMode,
  projectInput: string,
  input: VisualRepairProjectInput,
  generatedRoot?: string,
): Promise<VisualRepairResult> {
  return runModeCapability(mode, 'repair-source', () =>
    repairGeneratedProjectVisual(projectInput, input, generatedRoot),
  );
}
