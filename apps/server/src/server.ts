import Fastify from "fastify";
import { ProjectService } from "@yakable/project";
import type { ServerConfig } from "./config.js";
import { registerErrorHandler } from "./http/error.js";
import { registerRoutes } from "./routes/index.js";

export function createServer(config: ServerConfig) {
  const app = Fastify({
    logger: true,
  });

  const projectService = new ProjectService(config.project);

  registerErrorHandler(app);

  return {
    async start(): Promise<void> {
      const currentProject = await projectService.ensureDefaultProject();

      await registerRoutes(app, {
        currentProjectId: currentProject.id,
        projectService,
      });

      await app.listen({
        host: config.host,
        port: config.port,
      });
    },

    async stop(): Promise<void> {
      await app.close();
    },
  };
}
