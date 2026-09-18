import type { ProjectService } from "@yakable/project";
import type { FastifyPluginAsync } from "fastify";
import { HttpError } from "../http/error.js";

export type ProjectRoutesOptions = {
  currentProjectId: string;
  projectService: ProjectService;
};

type CreateProjectBody = {
  name?: string;
};

export const projectRoutes: FastifyPluginAsync<ProjectRoutesOptions> = async (
  app,
  { currentProjectId, projectService },
) => {
  app.get("/current", async () => {
    return projectService.getProject(currentProjectId);
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
