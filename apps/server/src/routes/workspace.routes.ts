import {
  ProjectNotFoundError,
  type ProjectService,
} from "@yakable/project";
import { WorkspacePathError } from "@yakable/workspace";
import type { FastifyPluginAsync } from "fastify";
import { HttpError } from "../http/error.js";

export type WorkspaceRoutesOptions = {
  currentProjectId: string;
  projectService: ProjectService;
};

type FileQuery = {
  path?: string;
};

type WriteFileBody = {
  path?: string;
  content?: string;
};

export const workspaceRoutes: FastifyPluginAsync<WorkspaceRoutesOptions> = async (
  app,
  { currentProjectId, projectService },
) => {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ProjectNotFoundError) {
      reply.code(404).send({ error: error.message });
      return;
    }

    if (error instanceof WorkspacePathError) {
      reply.code(400).send({ error: error.message });
      return;
    }

    throw error;
  });

  app.get("/tree", async () => {
    const { project, workspace } = await resolveWorkspace(
      currentProjectId,
      projectService,
    );

    return {
      projectId: project.id,
      workspaceId: project.workspaceId,
      entries: await workspace.listFiles(),
    };
  });

  app.get<{ Querystring: FileQuery }>("/file", async (request) => {
    const filePath = requiredPath(request.query.path);
    const { project, workspace } = await resolveWorkspace(
      currentProjectId,
      projectService,
    );

    return {
      projectId: project.id,
      workspaceId: project.workspaceId,
      path: filePath,
      content: await workspace.readFile(filePath),
    };
  });

  app.put<{ Body: WriteFileBody }>("/file", async (request) => {
    const { path, content } = request.body ?? {};

    if (typeof path !== "string" || typeof content !== "string") {
      throw new HttpError(400, "path and content are required");
    }

    const { workspace } = await resolveWorkspace(
      currentProjectId,
      projectService,
    );

    await workspace.writeFile(path, content);

    return { ok: true };
  });

  app.delete<{ Querystring: FileQuery }>("/file", async (request) => {
    const filePath = requiredPath(request.query.path);
    const { workspace } = await resolveWorkspace(
      currentProjectId,
      projectService,
    );

    await workspace.deleteFile(filePath);

    return { ok: true };
  });

  app.post("/reset", async () => {
    const { workspace } = await resolveWorkspace(
      currentProjectId,
      projectService,
    );

    await workspace.reset();

    return { ok: true };
  });
};

async function resolveWorkspace(
  projectId: string,
  projectService: ProjectService,
) {
  const project = await projectService.getProject(projectId);
  const workspace = await projectService.getWorkspace(project.id);

  return { project, workspace };
}

function requiredPath(filePath: string | undefined): string {
  if (!filePath) {
    throw new HttpError(400, "path is required");
  }

  return filePath;
}
