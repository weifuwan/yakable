export interface ProjectSummary {
  id: string;
  name: string;
  latestSessionId: string;
  updatedAt: string;
}

export interface ProjectPage {
  records: ProjectSummary[];
  total: number;
  pages: number;
  current: number;
  pageSize: number;
}

export interface ProjectModel {
  provider: string;
  model: string;
}

export type ProjectStatus = 'CREATED';

export interface ProjectDetails extends ProjectSummary {
  status: ProjectStatus;
  createdAt: string;
}

export interface CreateProjectInput {
  prompt: string;
  model: ProjectModel;
}
