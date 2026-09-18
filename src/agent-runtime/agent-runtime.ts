import { deepSeekModelClient } from '../model/deepseek.js';
import type { ModelClient } from '../model/model-client.js';
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
import {
  runApprovedPlanWorkflow,
  type ApprovedPlanWorkflowOptions,
  type ApprovedPlanWorkflowResult,
} from './workflows/approved-plan-workflow.js';
import {
  runCreateProjectWorkflow,
  type CreateProjectWorkflowOptions,
} from './workflows/create-project-workflow.js';

export type CreateProjectExecutor = (
  prompt: string,
  options?: CreateProjectWorkflowOptions,
) => Promise<GenerationResult>;

export type ApprovedPlanExecutor = (
  projectInput: string,
  options?: ApprovedPlanWorkflowOptions,
) => Promise<ApprovedPlanWorkflowResult>;

export interface AgentRuntimeDependencies {
  modelClient?: ModelClient;
  toolRouter?: ToolRouter;
  createProject?: CreateProjectExecutor;
  executeApprovedPlan?: ApprovedPlanExecutor;
  now?: () => Date;
}

export interface AgentRuntimeContextInput {
  operation: AgentRuntimeOperation;
  prompt: string;
  projectInput?: string;
}

export class AgentRuntime {
  readonly modelClient: ModelClient;
  readonly toolRouter: ToolRouter;

  private readonly createProjectExecutor: CreateProjectExecutor;
  private readonly approvedPlanExecutor: ApprovedPlanExecutor;
  private readonly now: () => Date;

  constructor(dependencies: AgentRuntimeDependencies = {}) {
    this.modelClient = dependencies.modelClient ?? deepSeekModelClient;
    this.toolRouter = dependencies.toolRouter ?? createDefaultToolRouter();
    this.createProjectExecutor = dependencies.createProject ?? runCreateProjectWorkflow;
    this.approvedPlanExecutor = dependencies.executeApprovedPlan ?? runApprovedPlanWorkflow;
    this.now = dependencies.now ?? (() => new Date());
  }

  createContext(input: AgentRuntimeContextInput): AgentRunContext {
    return createAgentRunContext({
      operation: input.operation,
      prompt: input.prompt,
      projectInput: input.projectInput,
      modelClientId: this.modelClient.id,
      availableTools: this.toolRouter.list().map((tool) => tool.name),
      startedAt: this.now().toISOString(),
    });
  }

  async createProject(
    prompt: string,
    options: CreateProjectWorkflowOptions = {},
  ): Promise<GenerationResult> {
    const context = this.createContext({
      operation: 'CREATE',
      prompt,
    });
    return this.createProjectExecutor(context.prompt, options);
  }

  async beginEditRun(
    projectInput: string,
    followUpRequest: string,
    options: BeginUnifiedEditRunOptions = {},
  ): Promise<UnifiedEditRunResult> {
    const context = this.createContext({
      operation: 'EDIT',
      projectInput,
      prompt: followUpRequest,
    });
    return beginUnifiedEditRun(context.projectInput!, context.prompt, options);
  }

  continueEditRun(
    runId: string,
    toolResult: AgentClientToolResult,
    options: ContinueUnifiedEditRunOptions = {},
  ): Promise<UnifiedEditRunResult> {
    return continueUnifiedEditRun(runId, toolResult, options);
  }

  async executeApprovedPlan(
    projectInput: string,
    options: ApprovedPlanWorkflowOptions = {},
  ): Promise<ApprovedPlanWorkflowResult> {
    const context = this.createContext({
      operation: 'EDIT',
      projectInput,
      prompt: 'Execute approved project plan',
    });
    return this.approvedPlanExecutor(context.projectInput!, options);
  }
}

export function createDefaultAgentRuntime(): AgentRuntime {
  return new AgentRuntime();
}
