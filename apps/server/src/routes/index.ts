import type { IncomingMessage, ServerResponse } from "node:http";
import type { WorkspaceService } from "@yakable/workspace";
import { sendJson } from "../http/json.js";
import { createWorkspaceRoutes } from "./workspace.routes.js";

export type RouteHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
) => boolean | Promise<boolean>;

type RoutesOptions = {
  workspaceId: string;
  workspace: WorkspaceService;
};

export function createRoutes(options: RoutesOptions): RouteHandler {
  const routes: RouteHandler[] = [createWorkspaceRoutes(options)];

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
