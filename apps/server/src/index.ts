import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WorkspacePathError,
  WorkspaceService,
} from "@yakable/workspace";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, "../../..");

const workspace = new WorkspaceService(
  path.join(repositoryRoot, ".yakable/workspaces/default"),
  path.join(repositoryRoot, "templates/react-vite"),
);

const port = Number(process.env.PORT ?? 8787);

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

await workspace.ensure();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (request.method === "GET" && url.pathname === "/api/workspace/tree") {
      sendJson(response, 200, {
        workspaceId: "default",
        entries: await workspace.listFiles(),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/workspace/file") {
      const filePath = url.searchParams.get("path");

      if (!filePath) {
        sendJson(response, 400, { error: "path is required" });
        return;
      }

      sendJson(response, 200, {
        path: filePath,
        content: await workspace.readFile(filePath),
      });
      return;
    }

    if (request.method === "PUT" && url.pathname === "/api/workspace/file") {
      const body = (await readJsonBody(request)) as {
        path?: unknown;
        content?: unknown;
      };

      if (typeof body.path !== "string" || typeof body.content !== "string") {
        sendJson(response, 400, {
          error: "path and content are required",
        });
        return;
      }

      await workspace.writeFile(body.path, body.content);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (
      request.method === "DELETE" &&
      url.pathname === "/api/workspace/file"
    ) {
      const filePath = url.searchParams.get("path");

      if (!filePath) {
        sendJson(response, 400, { error: "path is required" });
        return;
      }

      await workspace.deleteFile(filePath);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/workspace/reset"
    ) {
      await workspace.reset();
      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    if (error instanceof WorkspacePathError) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    console.error("[server]", error);
    sendJson(response, 500, { error: "Workspace operation failed" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Yakable server running at http://127.0.0.1:${port}`);
});
