import {
  createServer as createNodeServer,
  type Server as NodeServer,
} from "node:http";
import { ProjectService } from "@yakable/project";
import type { ServerConfig } from "./config.js";
import { handleHttpError } from "./http/error.js";
import { sendJson } from "./http/json.js";
import { createRoutes, type RouteHandler } from "./routes/index.js";

export function createServer(config: ServerConfig) {
  const projectService = new ProjectService(config.project);
  let routes: RouteHandler | undefined;

  const server: NodeServer = createNodeServer(async (request, response) => {
    try {
      if (!routes) {
        sendJson(response, 503, { error: "Server is starting" });
        return;
      }

      const url = new URL(request.url ?? "/", "http://localhost");
      await routes(request, response, url);
    } catch (error) {
      handleHttpError(response, error);
    }
  });

  return {
    async start(): Promise<void> {
      const currentProject = await projectService.ensureDefaultProject();

      routes = createRoutes({
        currentProjectId: currentProject.id,
        projectService,
      });

      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(config.port, config.host, () => {
          server.off("error", reject);
          resolve();
        });
      });

      console.log(
        `Yakable server running at http://${config.host}:${config.port}`,
      );
    },

    async stop(): Promise<void> {
      if (!server.listening) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}
