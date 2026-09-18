export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface ProjectModel {
  provider: string;
  model: string;
}

export type ProjectStatus = 'CREATED';

export interface ProjectDetails extends ProjectSummary {
  prompt: string;
  model: ProjectModel;
  status: ProjectStatus;
  createdAt: string;
}

export interface CreateProjectInput {
  prompt: string;
  model: ProjectModel;
}
