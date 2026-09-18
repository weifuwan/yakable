import type { ProjectService } from "@yakable/project";
import type { FastifyInstance } from "fastify";
import { projectRoutes } from "./project.routes.js";
import { workspaceRoutes } from "./workspace.routes.js";

export type RoutesOptions = {
  projectService: ProjectService;
};

export async function registerRoutes(
  app: FastifyInstance,
  options: RoutesOptions,
): Promise<void> {
  await app.register(projectRoutes, {
    prefix: "/api/projects",
    ...options,
  });

  await app.register(workspaceRoutes, {
    prefix: "/api/projects/:projectId/workspace",
    ...options,
  });
}
