import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { WorkspaceService } from "@yakable/workspace";

export type Project = {
  id: string;
  name: string;
  workspaceId: string;
  createdAt: string;
};

type ProjectServiceOptions = {
  projectsRoot: string;
  workspacesRoot: string;
  templatePath: string;
};

export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project "${projectId}" was not found.`);
    this.name = "ProjectNotFoundError";
  }
}

export class ProjectService {
  constructor(private readonly options: ProjectServiceOptions) {}

  async ensureDefaultProject(): Promise<Project> {
    const projectId = "project-default";

    try {
      return await this.getProject(projectId);
    } catch (error) {
      if (!(error instanceof ProjectNotFoundError)) {
        throw error;
      }
    }

    return this.createProjectRecord({
      id: projectId,
      name: "Untitled project",
      workspaceId: "workspace-default",
    });
  }

  async createProject(name: string): Promise<Project> {
    const projectId = `project-${randomUUID()}`;
    const workspaceId = `workspace-${randomUUID()}`;

    return this.createProjectRecord({
      id: projectId,
      name: name.trim() || "Untitled project",
      workspaceId,
    });
  }

  async getProject(projectId: string): Promise<Project> {
    validateId(projectId);

    try {
      const content = await readFile(this.projectFile(projectId), "utf8");
      return JSON.parse(content) as Project;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new ProjectNotFoundError(projectId);
      }

      throw error;
    }
  }

  async getWorkspace(projectId: string): Promise<WorkspaceService> {
    const project = await this.getProject(projectId);

    return new WorkspaceService(
      path.join(this.options.workspacesRoot, project.workspaceId),
      this.options.templatePath,
    );
  }

  private async createProjectRecord(input: {
    id: string;
    name: string;
    workspaceId: string;
  }): Promise<Project> {
    validateId(input.id);
    validateId(input.workspaceId);

    const project: Project = {
      ...input,
      createdAt: new Date().toISOString(),
    };

    await mkdir(this.options.projectsRoot, { recursive: true });
    await writeFile(
      this.projectFile(project.id),
      JSON.stringify(project, null, 2),
      "utf8",
    );

    const workspace = new WorkspaceService(
      path.join(this.options.workspacesRoot, project.workspaceId),
      this.options.templatePath,
    );

    await workspace.ensure();

    return project;
  }

  private projectFile(projectId: string): string {
    return path.join(this.options.projectsRoot, `${projectId}.json`);
  }
}

function validateId(id: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error("Invalid project or workspace id.");
  }
}
