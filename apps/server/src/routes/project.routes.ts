import type { ProjectService } from "@yakable/project";
import { HttpError } from "../http/error.js";
import { readJsonBody, sendJson } from "../http/json.js";
import type { RouteHandler } from "./index.js";

type ProjectRoutesOptions = {
  currentProjectId: string;
  projectService: ProjectService;
};

export function createProjectRoutes({
  currentProjectId,
  projectService,
}: ProjectRoutesOptions): RouteHandler {
  return async (request, response, url) => {
    if (!url.pathname.startsWith("/api/project")) {
      return false;
    }

    if (request.method === "GET" && url.pathname === "/api/project/current") {
      const project = await projectService.getProject(currentProjectId);
      sendJson(response, 200, project);
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/project") {
      const body = (await readJsonBody(request)) as { name?: unknown };

      if (body.name !== undefined && typeof body.name !== "string") {
        throw new HttpError(400, "name must be a string");
      }

      const project = await projectService.createProject(
        typeof body.name === "string" ? body.name : "Untitled project",
      );

      sendJson(response, 201, project);
      return true;
    }

    return false;
  };
}
