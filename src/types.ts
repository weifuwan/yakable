export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GeneratedProject {
  summary: string;
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
