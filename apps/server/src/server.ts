import Fastify from "fastify";
import { AgentService } from "@yakable/agent";
import { ProjectService } from "@yakable/project";
import type { ServerConfig } from "./config.js";
import { registerErrorHandler } from "./http/error.js";
import { registerRoutes } from "./routes/index.js";

export function createServer(config: ServerConfig) {
  const app = Fastify({
    logger: true,
  });

  const projectService = new ProjectService(config.project);
  const agentService = new AgentService(config.agent);

  registerErrorHandler(app);

  return {
    async start(): Promise<void> {
      await registerRoutes(app, {
        agentService,
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
