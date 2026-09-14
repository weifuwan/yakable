export type ProjectTemplate = 'website' | 'app';

export interface PromptIntent {
  version: 1;
  productType: string;
  pageType: string;
  primaryGoal: string;
  targetAudience: string | null;
  styleKeywords: string[];
  explicitRequirements: string[];
  hardConstraints: string[];
  missingInformation: string[];
}

export type SemanticDefaultKind =
  | 'structure'
  | 'content'
  | 'capability'
  | 'behavior'
  | 'quality';

export type SemanticDefaultBasis =
  | 'product-pattern'
  | 'page-pattern'
  | 'goal-pattern'
  | 'universal';

export type SemanticConfidence = 'high' | 'medium';

export interface SemanticDefault {
  kind: SemanticDefaultKind;
  value: string;
  basis: SemanticDefaultBasis;
  confidence: SemanticConfidence;
}

export interface SemanticExpansion {
  version: 1;
  defaults: SemanticDefault[];
  assumptions: string[];
  deferredDecisions: string[];
}

export type TasteDecisionArea =
  | 'visual-hierarchy'
  | 'composition'
  | 'typography'
  | 'color'
  | 'spacing-density'
  | 'surface-treatment'
  | 'imagery'
  | 'motion'
  | 'component-expression';

export type TasteDecisionBasis =
  | 'style-keyword'
  | 'product-context'
  | 'page-context'
  | 'audience-context'
  | 'explicit-requirement'
  | 'hard-constraint';

export type TasteIntensity = 'strong' | 'moderate' | 'subtle';

export interface TasteDecision {
  area: TasteDecisionArea;
  directive: string;
  basis: TasteDecisionBasis;
  intensity: TasteIntensity;
  sourceKeywords: string[];
}

export interface TasteTranslation {
  version: 1;
  designDirection: string;
  decisions: TasteDecision[];
  antiPatterns: string[];
  unresolvedDecisions: string[];
}

export interface DesignIntentProduct {
  type: string;
  surface: string;
  primaryGoal: string;
  targetAudience: string | null;
}

export type DesignIntentRequirementSource =
  | 'user-explicit'
  | 'user-constraint'
  | 'semantic-default'
  | 'semantic-assumption';

export type DesignIntentRequirementKind =
  | 'requirement'
  | 'constraint'
  | 'assumption'
  | SemanticDefaultKind;

export type DesignIntentRequirementConfidence = 'explicit' | SemanticConfidence;

export interface DesignIntentRequirement {
  statement: string;
  source: DesignIntentRequirementSource;
  kind: DesignIntentRequirementKind;
  confidence: DesignIntentRequirementConfidence;
  basis?: SemanticDefaultBasis;
}

export interface DesignIntentDirective {
  area: TasteDecisionArea;
  directive: string;
  basis: TasteDecisionBasis;
  intensity: TasteIntensity;
  sourceKeywords: string[];
}

export type DesignIntentOpenQuestionSource =
  | 'missing-information'
  | 'semantic-decision'
  | 'taste-decision';

export interface DesignIntentOpenQuestion {
  value: string;
  source: DesignIntentOpenQuestionSource;
}

export interface DesignIntentIR {
  version: 1;
  product: DesignIntentProduct;
  designDirection: string;
  styleSignals: string[];
  requirements: DesignIntentRequirement[];
  directives: DesignIntentDirective[];
  antiPatterns: string[];
  openQuestions: DesignIntentOpenQuestion[];
}

export interface ProjectRoute {
  path: string;
  title: string;
}

export interface ProjectMetadata {
  version: 1;
  template: ProjectTemplate;
  routes: ProjectRoute[];
  name?: string;
  starred?: boolean;
  createdAt?: string;
  updatedAt?: string;
  remixedFrom?: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GeneratedProject {
  summary: string;
  template: ProjectTemplate;
  routes: ProjectRoute[];
  files: GeneratedFile[];
}

export interface GenerationResult {
  project: GeneratedProject;
  outputDirectory: string;
  model: string;
  intent: PromptIntent;
  semanticExpansion: SemanticExpansion;
  tasteTranslation: TasteTranslation;
  designIntent: DesignIntentIR;
}

export interface ProjectPatch {
  summary: string;
  changes: GeneratedFile[];
}

export interface ProjectVisualSelection {
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
  visualSelections?: ProjectVisualSelection[];
}

export interface ProjectConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  model?: string;
  changedFiles?: string[];
  visualSelections?: ProjectVisualSelection[];
}

export interface ProjectConversation {
  projectId: string;
  createdAt: string;
  updatedAt: string;
  messages: ProjectConversationMessage[];
}

export interface ProjectSessionState {
  version: 1;
  productRequest?: string;
  designIntent?: DesignIntentIR;
  initialSummary?: string;
  createdAt: string;
  updatedAt: string;
  edits: ProjectEditHistoryItem[];
}
