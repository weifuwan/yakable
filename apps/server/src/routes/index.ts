import type { IncomingMessage, ServerResponse } from "node:http";
import type { ProjectService } from "@yakable/project";
import { sendJson } from "../http/json.js";
import { createProjectRoutes } from "./project.routes.js";
import { createWorkspaceRoutes } from "./workspace.routes.js";

export type RouteHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
) => boolean | Promise<boolean>;

type RoutesOptions = {
  currentProjectId: string;
  projectService: ProjectService;
};

export function createRoutes(options: RoutesOptions): RouteHandler {
  const routes: RouteHandler[] = [
    createProjectRoutes(options),
    createWorkspaceRoutes(options),
  ];

  return async (request, response, url) => {
    for (const route of routes) {
      if (await route(request, response, url)) {
        return true;
      }
    }

    sendJson(response, 404, { error: "Not found" });
    return true;
  };
}
