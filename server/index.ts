import 'dotenv/config';

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { repairPreviewIfNeeded } from './agent/auto-repair.js';
import { runAgent, type AgentHistoryMessage } from './agent/run-agent.js';
import { createProviderFromEnv } from './ai/provider-factory.js';
import { ensureProject, getProjectSnapshot } from './project/project-store.js';
import { PreviewRuntimeManager } from './runtime/preview-runtime.js';

const MAX_BODY_BYTES = 64 * 1024;
const provider = createProviderFromEnv();
const previewRuntime = new PreviewRuntimeManager();

function json(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  let body = '';

  for await (const chunk of request) {
    body += chunk.toString();

    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      throw new Error('Request body is too large');
    }
  }

  if (!body.trim()) {
    return {};
  }

  return JSON.parse(body) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseHistory(value: unknown): AgentHistoryMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(-20).flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const role = item.role;
    const content = item.content;

    if (
      (role !== 'user' && role !== 'assistant') ||
      typeof content !== 'string' ||
      !content.trim()
    ) {
      return [];
    }

    return [{ role, content: content.slice(0, 8000) }];
  });
}

function parseProjectId(value: unknown) {
  if (typeof value !== 'string') {
    throw new Error('projectId is required');
  }

  const projectId = value.trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(projectId)) {
    throw new Error('projectId must be 8-80 URL-safe characters');
  }

  return projectId;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (request.method === 'GET' && url.pathname === '/api/health') {
    json(response, 200, {
      status: 'ok',
      provider: provider.name,
      model: provider.model,
      phase: 'iterative-edit-and-repair',
    });
    return;
  }

  const previewMatch = url.pathname.match(
    /^\/preview\/([A-Za-z0-9_-]{8,80})(\/.*)?$/,
  );
  if ((request.method === 'GET' || request.method === 'HEAD') && previewMatch) {
    const projectId = previewMatch[1];

    if (!previewMatch[2]) {
      response.writeHead(307, {
        location: `/preview/${projectId}/${url.search}`,
        'cache-control': 'no-store',
      });
      response.end();
      return;
    }

    await previewRuntime.handlePreviewRequest(request, response, projectId);
    return;
  }

  const projectMatch = url.pathname.match(/^\/api\/projects\/([A-Za-z0-9_-]{8,80})$/);
  if (request.method === 'GET' && projectMatch) {
    try {
      const projectId = projectMatch[1];
      ensureProject(projectId);
      json(response, 200, {
        ...getProjectSnapshot(projectId),
        runtime: previewRuntime.getSnapshot(projectId),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Project request failed';
      json(response, 400, { error: detail });
    }
    return;
  }

  const repairMatch = url.pathname.match(
    /^\/api\/projects\/([A-Za-z0-9_-]{8,80})\/repair$/,
  );
  if (request.method === 'POST' && repairMatch) {
    try {
      const projectId = repairMatch[1];
      const body = await readJsonBody(request);
      const history = isRecord(body) ? parseHistory(body.history) : [];

      ensureProject(projectId);
      let runtime = previewRuntime.getSnapshot(projectId);
      if (runtime.status !== 'error') {
        runtime = await previewRuntime.syncProject(projectId);
      }

      const repaired = await repairPreviewIfNeeded(
        provider,
        previewRuntime,
        projectId,
        runtime,
        { history },
      );

      json(response, 200, {
        project: getProjectSnapshot(projectId),
        runtime: repaired.runtime,
        repair: repaired.repair,
        changedFiles: repaired.repair.changedFiles,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Repair request failed';
      json(response, 500, { error: detail });
    }
    return;
  }

  const runtimeMatch = url.pathname.match(
    /^\/api\/projects\/([A-Za-z0-9_-]{8,80})\/runtime$/,
  );
  if (runtimeMatch) {
    try {
      const projectId = runtimeMatch[1];

      if (request.method === 'GET') {
        json(response, 200, previewRuntime.getSnapshot(projectId));
        return;
      }

      if (request.method === 'POST') {
        ensureProject(projectId);
        json(response, 200, await previewRuntime.syncProject(projectId));
        return;
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Runtime request failed';
      json(response, 400, { error: detail });
      return;
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/agent/run') {
    try {
      const body = await readJsonBody(request);

      if (!isRecord(body) || typeof body.message !== 'string' || !body.message.trim()) {
        json(response, 400, { error: 'message is required' });
        return;
      }

      const projectId = parseProjectId(body.projectId);
      const history = parseHistory(body.history);
      const result = await runAgent(
        provider,
        projectId,
        body.message.trim().slice(0, 8000),
        history,
      );
      const initialRuntime = await previewRuntime.syncProject(projectId);
      const repaired = await repairPreviewIfNeeded(
        provider,
        previewRuntime,
        projectId,
        initialRuntime,
        { history },
      );

      json(response, 200, {
        ...result,
        project: getProjectSnapshot(projectId),
        changedFiles: unique([
          ...result.changedFiles,
          ...repaired.repair.changedFiles,
        ]),
        runtime: repaired.runtime,
        repair: repaired.repair,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Agent request failed';
      json(response, 500, { error: detail });
    }
    return;
  }

  json(response, 404, { error: 'Not found' });
});

const requestedPort = Number(process.env.YAKABLE_API_PORT ?? 8787);
const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 8787;

server.listen(port, '0.0.0.0', () => {
  console.log(
    `[yakable-api] listening on http://0.0.0.0:${port} (${provider.name}/${provider.model})`,
  );
});

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  await previewRuntime.disposeAll();
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});
