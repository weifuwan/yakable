import 'dotenv/config';

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { runAgent, type AgentHistoryMessage } from './agent/run-agent.js';
import { createProviderFromEnv } from './ai/provider-factory.js';
import { ensureProject, getProjectSnapshot } from './project/project-store.js';

const MAX_BODY_BYTES = 64 * 1024;
const provider = createProviderFromEnv();

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

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (request.method === 'GET' && url.pathname === '/api/health') {
    json(response, 200, {
      status: 'ok',
      provider: provider.name,
      model: provider.model,
      phase: 'project-generation',
    });
    return;
  }

  const projectMatch = url.pathname.match(/^\/api\/projects\/([A-Za-z0-9_-]{8,80})$/);
  if (request.method === 'GET' && projectMatch) {
    try {
      const projectId = projectMatch[1];
      ensureProject(projectId);
      json(response, 200, getProjectSnapshot(projectId));
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Project request failed';
      json(response, 400, { error: detail });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/agent/run') {
    try {
      const body = await readJsonBody(request);

      if (!isRecord(body) || typeof body.message !== 'string' || !body.message.trim()) {
        json(response, 400, { error: 'message is required' });
        return;
      }

      const projectId = parseProjectId(body.projectId);
      const result = await runAgent(
        provider,
        projectId,
        body.message.trim().slice(0, 8000),
        parseHistory(body.history),
      );

      json(response, 200, result);
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

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
