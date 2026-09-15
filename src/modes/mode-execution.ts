import {
  checkWorkflowProject,
  createDefaultAgentRuntime,
  readWorkflowProjectSnapshot,
  type ApprovedPlanWorkflowOptions,
  type ApprovedPlanWorkflowResult,
  type UnifiedEditRunResult,
} from '../agent-runtime/index.js';
import type { EditGeneratedProjectOptions } from '../editing/edit.js';
import type {
  VisualRepairProjectInput,
  VisualRepairResult,
} from '../editing/visual-repair.js';
import { repairGeneratedProjectVisual } from '../editing/visual-repair.js';
import type { GenerateProjectOptions } from '../generation/generate.js';
import type { GenerationResult } from '../types.js';
import {
  assertModeCapability,
  type YakableMode,
  type YakableModeCapability,
} from './mode-contract.js';

const agentRuntime = createDefaultAgentRuntime();

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
    agentRuntime.createProject(prompt, { ...options, mode }),
  );
}

export function beginEditRunInMode(
  mode: YakableMode,
  projectInput: string,
  followUpRequest: string,
  options: EditGeneratedProjectOptions = {},
): Promise<UnifiedEditRunResult> {
  return runModeCapability(mode, 'edit-source', () =>
    agentRuntime.beginEditRun(projectInput, followUpRequest, options, mode),
  );
}

export function executeApprovedPlanInMode(
  mode: YakableMode,
  projectInput: string,
  options: Omit<ApprovedPlanWorkflowOptions, 'mode'> = {},
): Promise<ApprovedPlanWorkflowResult> {
  return runModeCapability(mode, 'execute-plan', () =>
    agentRuntime.executeApprovedPlan(projectInput, { ...options, mode }),
  );
}

export async function repairGeneratedProjectVisualInMode(
  mode: YakableMode,
  projectInput: string,
  input: VisualRepairProjectInput,
  generatedRoot?: string,
): Promise<VisualRepairResult> {
  return runModeCapability(mode, 'repair-source', async () => {
    const workflow = agentRuntime.createWorkflowContext(mode);
    const { changeSet: _changeSet, ...result } = await repairGeneratedProjectVisual(
      projectInput,
      input,
      {
        generatedRoot,
        modelClient: workflow.modelClient,
        readFiles: async (project, paths, agent) => (
          await readWorkflowProjectSnapshot(workflow, project, paths, agent)
        ).files,
        checkProject: (project, agent) => checkWorkflowProject(
          workflow,
          project.directory,
          agent,
        ),
      },
    );
    return result;
  });
}
