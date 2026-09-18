import type { FastifyInstance } from "fastify";
import { ProjectNotFoundError } from "@yakable/project";
import { WorkspacePathError } from "@yakable/workspace";

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      reply.code(error.statusCode).send({ error: error.message });
      return;
    }

    if (error instanceof ProjectNotFoundError) {
      reply.code(404).send({ error: error.message });
      return;
    }

    if (error instanceof WorkspacePathError) {
      reply.code(400).send({ error: error.message });
      return;
    }

    app.log.error(error);
    reply.code(500).send({ error: "Internal server error" });
  });
}
