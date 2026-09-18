import type { ServerResponse } from "node:http";
import { WorkspacePathError } from "@yakable/workspace";
import { sendJson } from "./json.js";

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function handleHttpError(
  response: ServerResponse,
  error: unknown,
): void {
  if (error instanceof HttpError) {
    sendJson(response, error.statusCode, { error: error.message });
    return;
  }

  if (error instanceof WorkspacePathError) {
    sendJson(response, 400, { error: error.message });
    return;
  }

  console.error("[server]", error);
  sendJson(response, 500, { error: "Internal server error" });
}
