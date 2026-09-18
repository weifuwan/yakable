import type { ProjectService } from "@yakable/project";
import { HttpError } from "../http/error.js";
import { readJsonBody, sendJson } from "../http/json.js";
import type { RouteHandler } from "./index.js";

type WorkspaceRoutesOptions = {
  currentProjectId: string;
  projectService: ProjectService;
};

export function createWorkspaceRoutes({
  currentProjectId,
  projectService,
}: WorkspaceRoutesOptions): RouteHandler {
  return async (request, response, url) => {
    if (!url.pathname.startsWith("/api/workspace")) {
      return false;
    }

    const project = await projectService.getProject(currentProjectId);
    const workspace = await projectService.getWorkspace(project.id);

    if (request.method === "GET" && url.pathname === "/api/workspace/tree") {
      sendJson(response, 200, {
        projectId: project.id,
        workspaceId: project.workspaceId,
        entries: await workspace.listFiles(),
      });
      return true;
    }

    if (request.method === "GET" && url.pathname === "/api/workspace/file") {
      const filePath = requiredPath(url);

      sendJson(response, 200, {
        projectId: project.id,
        workspaceId: project.workspaceId,
        path: filePath,
        content: await workspace.readFile(filePath),
      });
      return true;
    }

    if (request.method === "PUT" && url.pathname === "/api/workspace/file") {
      const body = (await readJsonBody(request)) as {
        path?: unknown;
        content?: unknown;
      };

      if (typeof body.path !== "string" || typeof body.content !== "string") {
        throw new HttpError(400, "path and content are required");
      }

      await workspace.writeFile(body.path, body.content);
      sendJson(response, 200, { ok: true });
      return true;
    }

    if (
      request.method === "DELETE" &&
      url.pathname === "/api/workspace/file"
    ) {
      await workspace.deleteFile(requiredPath(url));
      sendJson(response, 200, { ok: true });
      return true;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/workspace/reset"
    ) {
      await workspace.reset();
      sendJson(response, 200, { ok: true });
      return true;
    }

    return false;
  };
}

function requiredPath(url: URL): string {
  const filePath = url.searchParams.get("path");

  if (!filePath) {
    throw new HttpError(400, "path is required");
  }

  return filePath;
}
