import type {
  AgentClientToolResult,
  UnifiedEditRunResult,
} from '../agent-runtime/edit-run.js';
import type { AgentProtocolItem } from '../protocol/agent-protocol.js';
import type {
  ProjectListRecord,
  ProjectUpdate,
} from '../projects/project-actions.js';
import type { ProjectMessageDecision } from '../prompt-intelligence/project-message.js';
import type { AgentRunStatus } from '../storage/agent-run.js';
import type { ProjectLifecycleStatus } from '../storage/project-lifecycle.js';
import type {
  BuildIntentDecision,
  ProjectConversation,
  ProjectMetadata,
  ProjectRoute,
  ProjectSessionState,
  ProjectTemplate,
} from '../types.js';

export type WebProjectListItem = ProjectListRecord;

export interface WebGeneratedProject {
  id: string;
  name: string;
  summary: string;
  model: string;
  template: ProjectTemplate;
  routes: ProjectRoute[];
  agentRunId?: string;
  session: ProjectSessionState | null;
  conversation: ProjectConversation | null;
}

export interface WebProjectMessageResult {
  decision: ProjectMessageDecision;
  conversation: ProjectConversation | null;
}

export interface WebCreateProjectReservation {
  projectId: string;
  agentRunId: string;
  createdAt: string;
}

export interface WebCreateProjectBootstrap {
  reservation: WebCreateProjectReservation;
  project: {
    id: string;
    name: string;
    prompt: string;
    status: ProjectLifecycleStatus;
    createdAt: string;
    updatedAt: string;
  };
  run: {
    id: string;
    status: AgentRunStatus;
    startedAt: string;
  };
}

export interface WebCreateProjectStatus {
  project: {
    id: string;
    name: string;
    prompt: string;
    status: ProjectLifecycleStatus;
    activeRunId?: string;
    failureMessage?: string;
    createdAt: string;
    updatedAt: string;
  };
  run: {
    id: string;
    status: AgentRunStatus;
    model?: string;
    summary?: string;
    startedAt: string;
    completedAt?: string;
    items: AgentProtocolItem[];
  } | null;
}

export interface WebCreateRecoveryResult {
  failedProjectIds: string[];
  runtimePendingProjectIds: string[];
}

export interface RuntimeSession {
  url: string;
  metadata: ProjectMetadata;
  isAlive(): boolean;
  close(): Promise<void>;
}

export interface WebApiServices {
  listProjects(): Promise<WebProjectListItem[]>;
  gateBuildIntent(prompt: string): Promise<BuildIntentDecision>;
  bootstrapCreate?(
    prompt: string,
    buildIntent: BuildIntentDecision,
  ): Promise<WebCreateProjectBootstrap>;
  readCreateStatus?(projectId: string): Promise<WebCreateProjectStatus | null>;
  reconcileInterruptedCreates?(): Promise<WebCreateRecoveryResult>;
  generate(
    prompt: string,
    buildIntent: BuildIntentDecision,
    onAgentItem?: (item: AgentProtocolItem) => void,
    reservation?: WebCreateProjectReservation,
  ): Promise<WebGeneratedProject>;
  message?(projectId: string, prompt: string): Promise<WebProjectMessageResult>;
  beginEditRun(
    projectId: string,
    prompt: string,
    onRunCreated?: (runId: string) => void,
    onAgentItem?: (item: AgentProtocolItem) => void,
  ): Promise<UnifiedEditRunResult>;
  continueEditRun(
    runId: string,
    result: AgentClientToolResult,
    onAgentItem?: (item: AgentProtocolItem) => void,
  ): Promise<UnifiedEditRunResult>;
  startRuntime(projectId: string): Promise<RuntimeSession>;
  readSession?(projectId: string): Promise<ProjectSessionState | null>;
  readConversation?(projectId: string): Promise<ProjectConversation | null>;
  updateProject?(projectId: string, patch: ProjectUpdate): Promise<WebProjectListItem>;
  remixProject?(projectId: string): Promise<WebProjectListItem>;
  deleteProject?(projectId: string): Promise<void>;
}
