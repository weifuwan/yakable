import type { IncomingMessage, ServerResponse } from "node:http";
import type { WorkspaceService } from "@yakable/workspace";
import { HttpError } from "../http/error.js";
import { readJsonBody, sendJson } from "../http/json.js";
import type { RouteHandler } from "./index.js";

type WorkspaceRoutesOptions = {
  workspaceId: string;
  workspace: WorkspaceService;
};

export function createWorkspaceRoutes({
  workspaceId,
  workspace,
}: WorkspaceRoutesOptions): RouteHandler {
  return async (request, response, url) => {
    if (!url.pathname.startsWith("/api/workspace")) {
      return false;
    }

    if (request.method === "GET" && url.pathname === "/api/workspace/tree") {
      sendJson(response, 200, {
        workspaceId,
        entries: await workspace.listFiles(),
      });
      return true;
    }

    if (request.method === "GET" && url.pathname === "/api/workspace/file") {
      const filePath = requiredPath(url);

      sendJson(response, 200, {
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
