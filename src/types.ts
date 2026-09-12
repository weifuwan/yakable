export type ProjectTemplate = 'website' | 'app';

export interface ProjectRoute {
  path: string;
  title: string;
}

export interface ProjectMetadata {
  version: 1;
  template: ProjectTemplate;
  routes: ProjectRoute[];
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
}

export interface ProjectPatch {
  summary: string;
  changes: GeneratedFile[];
}
