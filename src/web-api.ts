import { readdir, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

import { editGeneratedProject } from './edit.js';
import { generateProject } from './generate.js';
import { resolveGeneratedProject, startGeneratedProject } from './runtime.js';

const DEFAULT_API_HOST = '127.0.0.1';
const DEFAULT_API_PORT = 8787;
const MAX_JSON_BODY_BYTES = 32_000;
const PROJECT_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

export interface WebProjectListItem {
  id: string;
  updatedAt: string;
}

export interface WebGeneratedProject {
  id: string;
  summary: string;
  model: string;
}

export interface WebEditedProject {
  projectId: string;
  summary: string;
  model: string;
  changedFiles: string[];
}

export interface RuntimeSession {
  url: string;
  isAlive(): boolean;
  close(): Promise<void>;
}

export interface WebApiServices {
  listProjects(): Promise<WebProjectListItem[]>;
  generate(prompt: string): Promise<WebGeneratedProject>;
  edit(projectId: string, prompt: string): Promise<WebEditedProject>;
  startRuntime(projectId: string): Promise<RuntimeSession>;
}

export interface YakableApiServer {
  server: Server;
  listen(port?: number, host?: string): Promise<string>;
  close(): Promise<void>;
}

function assertProjectId(value: string): string {
  const decoded = decodeURIComponent(value);
  if (!decoded || !PROJECT_ID_PATTERN.test(decoded)) {
    throw new Error('Invalid generated project id.');
  }
  return decoded;
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > MAX_JSON_BODY_BYTES) {
      throw new Error(`Request body is too large (max ${MAX_JSON_BODY_BYTES} bytes).`);
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('Request body must be a JSON object.');
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Request body is not valid JSON.');
    }
    throw error;
  }
}

function readPrompt(body: Record<string, unknown>): string {
  if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
    throw new Error('A prompt is required.');
  }
  return body.prompt.trim();
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(value));
}

function isClientError(error: Error): boolean {
  return /required|invalid|too large|too long|does not exist|missing|only|must|not valid json/i.test(
    error.message,
  );
}

function addRevision(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}revision=${Date.now()}`;
}

export function createDefaultWebApiServices(
  generatedRoot = path.resolve(process.cwd(), 'generated'),
): WebApiServices {
  return {
    async listProjects() {
      const entries = await readdir(generatedRoot, { withFileTypes: true }).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT') {
            return [];
          }
          throw error;
        },
      );

      const projects = await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            const info = await stat(path.join(generatedRoot, entry.name));
            return { id: entry.name, updatedAt: info.mtime.toISOString() };
          }),
      );

      return projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },

    async generate(prompt) {
      const result = await generateProject(prompt);
      return {
        id: path.basename(result.outputDirectory),
        summary: result.project.summary,
        model: result.model,
      };
    },

    async edit(projectId, prompt) {
      const result = await editGeneratedProject(projectId, prompt);
      return {
        projectId: result.projectId,
        summary: result.summary,
        model: result.model,
        changedFiles: result.changedFiles,
      };
    },

    async startRuntime(projectId) {
      const project = await resolveGeneratedProject(projectId, generatedRoot);
      const started = await startGeneratedProject(project, { port: 0 });
      return {
        url: started.url,
        isAlive: () => Boolean(started.server.httpServer?.listening),
        close: async () => {
          await started.server.close();
        },
      };
    },
  };
}

export function createYakableApiServer(options: { services?: WebApiServices } = {}): YakableApiServer {
  const services = options.services ?? createDefaultWebApiServices();
  const runtimes = new Map<string, RuntimeSession>();

  async function ensureRuntime(projectId: string): Promise<RuntimeSession> {
    const current = runtimes.get(projectId);
    if (current?.isAlive()) {
      return current;
    }
    if (current) {
      await current.close().catch(() => undefined);
      runtimes.delete(projectId);
    }

    const runtime = await services.startRuntime(projectId);
    runtimes.set(projectId, runtime);
    return runtime;
  }

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const method = request.method ?? 'GET';

      if (method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, { ok: true, stage: 'web-product-flow' });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/projects') {
        sendJson(response, 200, { projects: await services.listProjects() });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/projects') {
        const body = await readJsonBody(request);
        const project = await services.generate(readPrompt(body));
        const runtime = await ensureRuntime(project.id);
        sendJson(response, 201, {
          project,
          previewUrl: addRevision(runtime.url),
        });
        return;
      }

      const projectRoute = url.pathname.match(/^\/api\/projects\/([^/]+)\/(runtime|edit)$/);
      if (method === 'POST' && projectRoute) {
        const projectId = assertProjectId(projectRoute[1] ?? '');
        const action = projectRoute[2];

        if (action === 'runtime') {
          const runtime = await ensureRuntime(projectId);
          sendJson(response, 200, { projectId, previewUrl: addRevision(runtime.url) });
          return;
        }

        const body = await readJsonBody(request);
        const edit = await services.edit(projectId, readPrompt(body));
        const runtime = await ensureRuntime(projectId);
        sendJson(response, 200, {
          ...edit,
          previewUrl: addRevision(runtime.url),
        });
        return;
      }

      sendJson(response, 404, { error: 'Not found.' });
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error('Unknown API failure.');
      console.error('[Yakable API]', normalized);
      sendJson(response, isClientError(normalized) ? 400 : 500, { error: normalized.message });
    }
  });

  server.requestTimeout = 660_000;

  return {
    server,
    async listen(port = DEFAULT_API_PORT, host = DEFAULT_API_HOST) {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          server.off('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          server.off('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, host);
      });

      const address = server.address() as AddressInfo | null;
      if (!address) {
        throw new Error('Yakable API started without a network address.');
      }
      return `http://${host}:${address.port}`;
    },
    async close() {
      await Promise.all([...runtimes.values()].map((runtime) => runtime.close().catch(() => undefined)));
      runtimes.clear();

      if (!server.listening) {
        return;
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
