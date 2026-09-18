import {
  AgentConfigurationError,
  AgentResponseError,
  type AgentService,
} from "@yakable/agent";
import {
  ProjectNotFoundError,
  type ProjectService,
} from "@yakable/project";
import { WorkspacePathError } from "@yakable/workspace";
import type { FastifyPluginAsync } from "fastify";
import { HttpError } from "../http/error.js";

export type AgentRoutesOptions = {
  agentService: AgentService;
  projectService: ProjectService;
};

type ProjectParams = {
  projectId: string;
};

type RunAgentBody = {
  prompt?: string;
};

export const agentRoutes: FastifyPluginAsync<AgentRoutesOptions> = async (
  app,
  { agentService, projectService },
) => {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ProjectNotFoundError) {
      reply.code(404).send({ error: error.message });
      return;
    }

    if (error instanceof WorkspacePathError) {
      reply.code(400).send({ error: error.message });
      return;
    }

    if (error instanceof AgentConfigurationError) {
      reply.code(503).send({ error: error.message });
      return;
    }

    if (error instanceof AgentResponseError) {
      reply.code(502).send({ error: error.message });
      return;
    }

    throw error;
  });

  app.post<{ Params: ProjectParams; Body: RunAgentBody }>(
    "/run",
    async (request) => {
      const prompt = request.body?.prompt?.trim();

      if (!prompt) {
        throw new HttpError(400, "prompt is required");
      }

      const workspace = await projectService.getWorkspace(
        request.params.projectId,
      );

      const currentApp = await workspace.readFile("src/App.tsx");
      const generated = await agentService.generateApp({
        prompt,
        currentApp,
      });

      await workspace.writeFile(generated.path, generated.content);

      return {
        projectId: request.params.projectId,
        changedFiles: [generated.path],
      };
    },
  );
};
