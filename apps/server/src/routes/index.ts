import type { AgentService } from "@yakable/agent";
import type { ProjectService } from "@yakable/project";
import type { FastifyInstance } from "fastify";
import { agentRoutes } from "./agent.routes.js";
import { projectRoutes } from "./project.routes.js";
import { workspaceRoutes } from "./workspace.routes.js";

export type RoutesOptions = {
  agentService: AgentService;
  projectService: ProjectService;
};

export async function registerRoutes(
  app: FastifyInstance,
  options: RoutesOptions,
): Promise<void> {
  await app.register(projectRoutes, {
    prefix: "/api/projects",
    projectService: options.projectService,
  });

  await app.register(workspaceRoutes, {
    prefix: "/api/projects/:projectId/workspace",
    projectService: options.projectService,
  });

  await app.register(agentRoutes, {
    prefix: "/api/projects/:projectId/agent",
    agentService: options.agentService,
    projectService: options.projectService,
  });
}
