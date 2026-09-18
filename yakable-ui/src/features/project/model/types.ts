export type ProjectTemplate = 'website' | 'app';
export type BuildIntentRoute = 'CREATE' | 'CHAT' | 'CLARIFY';
export type BuildIntentConfidence = 'high' | 'medium';

export interface BuildIntentDecision {
  version: 1;
  route: BuildIntentRoute;
  confidence: BuildIntentConfidence;
  message: string;
}

export type ProjectMessageRoute = 'CHAT' | 'CLARIFY' | 'BUILD' | 'EDIT';
export type ProjectMessageConfidence = 'high' | 'medium';

export interface ProjectMessageDecision {
  version: 1;
  route: ProjectMessageRoute;
  confidence: ProjectMessageConfidence;
  message: string;
}

export interface ProjectRoute {
  path: string;
  title: string;
}

export interface PersistedVisualSelection {
  sourceId?: string;
  file?: string;
  line?: number;
  column?: number;
  tagName: string;
  text: string;
  selector: string;
}

export interface ProjectEditHistoryItem {
  id: string;
  createdAt: string;
  userRequest: string;
  assistantSummary: string;
  changedFiles: string[];
  model?: string;
  visualSelections?: PersistedVisualSelection[];
}

export interface ProjectSession {
  version: 1;
  productRequest?: string;
  designIntent?: unknown;
  initialSummary?: string;
  createdAt: string;
  updatedAt: string;
  edits: ProjectEditHistoryItem[];
}

export interface ProjectConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  model?: string;
  changedFiles?: string[];
  visualSelections?: PersistedVisualSelection[];
  agentRun?: unknown;
}

export interface ProjectConversation {
  projectId: string;
  createdAt: string;
  updatedAt: string;
  messages: ProjectConversationMessage[];
}

export interface ProjectListItem {
  id: string;
  name: string;
  updatedAt: string;
  createdAt?: string;
  starred: boolean;
  template: ProjectTemplate;
  remixedFrom?: string;
}

export interface RuntimeProject {
  projectId: string;
  name: string;
  starred: boolean;
  previewUrl: string;
  template: ProjectTemplate;
  routes: ProjectRoute[];
  session: ProjectSession | null;
  conversation: ProjectConversation | null;
}

export interface ProjectMessageRoutingResult {
  decision: ProjectMessageDecision;
  conversation: ProjectConversation | null;
}
