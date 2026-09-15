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

export interface RuntimeSession {
  url: string;
  metadata: ProjectMetadata;
  isAlive(): boolean;
  close(): Promise<void>;
}

export interface WebApiServices {
  listProjects(): Promise<WebProjectListItem[]>;
  gateBuildIntent(prompt: string): Promise<BuildIntentDecision>;
  generate(
    prompt: string,
    buildIntent: BuildIntentDecision,
    onAgentItem?: (item: AgentProtocolItem) => void,
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
