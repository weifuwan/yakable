import {
  createServer as createNodeServer,
  type Server as NodeServer,
} from "node:http";
import { WorkspaceService } from "@yakable/workspace";
import type { ServerConfig } from "./config.js";
import { handleHttpError } from "./http/error.js";
import { createRoutes } from "./routes/index.js";

export function createServer(config: ServerConfig) {
  const workspace = new WorkspaceService(
    config.workspace.rootPath,
    config.workspace.templatePath,
  );

  const routes = createRoutes({
    workspaceId: config.workspace.id,
    workspace,
  });

  const server: NodeServer = createNodeServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      await routes(request, response, url);
    } catch (error) {
      handleHttpError(response, error);
    }
  });

  return {
    async start(): Promise<void> {
      await workspace.ensure();

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
