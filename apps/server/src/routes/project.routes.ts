import {
  ProjectNotFoundError,
  type ProjectService,
} from "@yakable/project";
import type { FastifyPluginAsync } from "fastify";
import { HttpError } from "../http/error.js";

export type ProjectRoutesOptions = {
  projectService: ProjectService;
};

type ProjectParams = {
  projectId: string;
};

type CreateProjectBody = {
  name?: string;
};

export const projectRoutes: FastifyPluginAsync<ProjectRoutesOptions> = async (
  app,
  { projectService },
) => {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ProjectNotFoundError) {
      reply.code(404).send({ error: error.message });
      return;
    }

    throw error;
  });

  app.get("/default", async () => {
    return projectService.ensureDefaultProject();
  });

  app.get<{ Params: ProjectParams }>("/:projectId", async (request) => {
    return projectService.getProject(request.params.projectId);
  });

  app.post<{ Body: CreateProjectBody }>("/", async (request, reply) => {
    const { name } = request.body ?? {};

    if (name !== undefined && typeof name !== "string") {
      throw new HttpError(400, "name must be a string");
    }

    const project = await projectService.createProject(
      name?.trim() || "Untitled project",
    );

    return reply.code(201).send(project);
  });
};
