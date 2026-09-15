import {
  editGeneratedProject,
  type EditGeneratedProjectOptions,
  type EditProjectResult,
} from '../editing/edit.js';
import {
  generateProject,
  type GenerateProjectOptions,
} from '../generation/generate.js';
import { deepSeekModelClient } from '../model/deepseek.js';
import type { ModelClient } from '../model/model-client.js';
import {
  assertModeCapability,
  type YakableMode,
} from '../modes/mode-contract.js';
import type { GenerationResult } from '../types.js';
import {
  beginUnifiedEditRun,
  continueUnifiedEditRun,
  type AgentClientToolResult,
  type BeginUnifiedEditRunOptions,
  type ContinueUnifiedEditRunOptions,
  type UnifiedEditRunResult,
} from './edit-run.js';
import {
  createAgentRunContext,
  type AgentRunContext,
  type AgentRuntimeOperation,
} from './run-context.js';
import { createDefaultToolRouter, type ToolRouter } from './tool-router.js';

export type GenerateProjectExecutor = (
  prompt: string,
  options?: GenerateProjectOptions,
) => Promise<GenerationResult>;

export type EditProjectExecutor = (
  projectInput: string,
  followUpRequest: string,
  options?: EditGeneratedProjectOptions,
) => Promise<EditProjectResult>;

export interface AgentRuntimeDependencies {
  modelClient?: ModelClient;
  toolRouter?: ToolRouter;
  generateProject?: GenerateProjectExecutor;
  editProject?: EditProjectExecutor;
  now?: () => Date;
}

export interface AgentRuntimeContextInput {
  operation: AgentRuntimeOperation;
  prompt: string;
  projectInput?: string;
  mode?: YakableMode;
}

export class AgentRuntime {
  readonly modelClient: ModelClient;
  readonly toolRouter: ToolRouter;

  private readonly generateProjectExecutor: GenerateProjectExecutor;
  private readonly editProjectExecutor: EditProjectExecutor;
  private readonly now: () => Date;

  constructor(dependencies: AgentRuntimeDependencies = {}) {
    this.modelClient = dependencies.modelClient ?? deepSeekModelClient;
    this.toolRouter = dependencies.toolRouter ?? createDefaultToolRouter();
    this.generateProjectExecutor = dependencies.generateProject ?? generateProject;
    this.editProjectExecutor = dependencies.editProject ?? editGeneratedProject;
    this.now = dependencies.now ?? (() => new Date());
  }

  createContext(input: AgentRuntimeContextInput): AgentRunContext {
    const mode = input.mode ?? 'BUILD';
    return createAgentRunContext({
      operation: input.operation,
      mode,
      prompt: input.prompt,
      projectInput: input.projectInput,
      modelClientId: this.modelClient.id,
      availableTools: this.toolRouter.list(mode).map((tool) => tool.name),
      startedAt: this.now().toISOString(),
    });
  }

  async createProject(
    prompt: string,
    options: GenerateProjectOptions = {},
  ): Promise<GenerationResult> {
    const context = this.createContext({
      operation: 'CREATE',
      prompt,
      mode: options.mode,
    });
    assertModeCapability(context.mode, 'generate-source');
    return this.generateProjectExecutor(context.prompt, {
      ...options,
      mode: context.mode,
    });
  }

  async editProject(
    projectInput: string,
    followUpRequest: string,
    options: EditGeneratedProjectOptions = {},
    mode: YakableMode = 'BUILD',
  ): Promise<EditProjectResult> {
    const context = this.createContext({
      operation: 'EDIT',
      projectInput,
      prompt: followUpRequest,
      mode,
    });
    assertModeCapability(context.mode, 'edit-source');
    return this.editProjectExecutor(
      context.projectInput!,
      context.prompt,
      options,
    );
  }

  async beginEditRun(
    projectInput: string,
    followUpRequest: string,
    options: BeginUnifiedEditRunOptions = {},
    mode: YakableMode = 'BUILD',
  ): Promise<UnifiedEditRunResult> {
    const context = this.createContext({
      operation: 'EDIT',
      projectInput,
      prompt: followUpRequest,
      mode,
    });
    assertModeCapability(context.mode, 'edit-source');
    return beginUnifiedEditRun(context.projectInput!, context.prompt, options);
  }

  continueEditRun(
    runId: string,
    toolResult: AgentClientToolResult,
    options: ContinueUnifiedEditRunOptions = {},
  ): Promise<UnifiedEditRunResult> {
    return continueUnifiedEditRun(runId, toolResult, options);
  }
}

export function createDefaultAgentRuntime(): AgentRuntime {
  return new AgentRuntime();
}
