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
}

export interface ProjectPatch {
  summary: string;
  changes: GeneratedFile[];
}
