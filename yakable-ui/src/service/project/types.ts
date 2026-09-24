export interface ProjectSummary {
  id: string;
  name: string;
  latestSessionId: string;
  updatedAt: string;
}

export interface ProjectModel {
  provider: string;
  model: string;
}

export interface CreateProjectInput {
  prompt: string;
  model: ProjectModel;
  requestId: string;
}

export interface ProjectFiles {
  files: string[];
}

export interface ProjectFile {
  path: string;
  content: string;
}
