import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

import { editGeneratedProject } from '../editing/edit.js';
import { generateProject } from '../generation/generate.js';
import {
  deleteManagedProject,
  listManagedProjects,
  remixManagedProject,
  touchManagedProject,
  updateManagedProject,
  type ProjectListRecord,
  type ProjectUpdate,
} from '../projects/project-actions.js';
import { readProjectMetadata } from '../projects/project-metadata.js';
import {
  readProjectConversation,
  readProjectSession,
} from '../projects/project-session.js';
import { resolveGeneratedProject, startGeneratedProject } from '../runtime/runtime.js';
import type {
  ProjectConversation,
  ProjectMetadata,
  ProjectRoute,
  ProjectSessionState,
  ProjectTemplate,
} from '../types.js';

const DEFAULT_API_HOST = '127.0.0.1';
const DEFAULT_API_PORT = 8787;
const MAX_JSON_BODY_BYTES = 32_000;
const PROJECT_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

export type WebProjectListItem = ProjectListRecord;

export interface WebGeneratedProject {
  id: string;
  name: string;
  summary: string;
  model: string;
  template: ProjectTemplate;
  routes: ProjectRoute[];
  session: ProjectSessionState | null;
  conversation: ProjectConversation | null;
}

export interface WebEditedProject {
  projectId: string;
  summary: string;
  model: string;
  changedFiles: string[];
  session: ProjectSessionState | null;
  conversation: ProjectConversation | null;
}

export interface RuntimeSession {
  url: string;
  metadata: ProjectMetadata;
  isAlive(): boolean;
  close(): Promise<void>;
}

export interface WebApiServices {
  listProjects(): Promise<WebProjectListItem[]>;
  generate(prompt: string): Promise<WebGeneratedProject>;
  edit(projectId: string, prompt: string): Promise<WebEditedProject>;
  startRuntime(projectId: string): Promise<RuntimeSession>;
  readSession?(projectId: string): Promise<ProjectSessionState | null>;
  readConversation?(projectId: string): Promise<ProjectConversation | null>;
  updateProject?(projectId: string, patch: ProjectUpdate): Promise<WebProjectListItem>;
  remixProject?(projectId: string): Promise<WebProjectListItem>;
  deleteProject?(projectId: string): Promise<void>;
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

function projectNameFromId(projectId: string): string {
  const base = projectId.replace(/-\d{4}-\d{2}-\d{2}T.*$/, '');
  return (base || projectId)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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

  if (chunks.length === 0) return {};

  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('Request body must be a JSON object.');
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Request body is not valid JSON.');
    throw error;
  }
}

function readPrompt(body: Record<string, unknown>): string {
  if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
    throw new Error('A prompt is required.');
  }
  return body.prompt.trim();
}

function readProjectUpdate(body: Record<string, unknown>): ProjectUpdate {
  const patch: ProjectUpdate = {};
  if ('name' in body) {
    if (typeof body.name !== 'string') throw new Error('Project name must be a string.');
    patch.name = body.name;
  }
  if ('starred' in body) {
    if (typeof body.starred !== 'boolean') throw new Error('Project starred must be a boolean.');
    patch.starred = body.starred;
  }
  return patch;
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

async function runtimePayload(
  projectId: string,
  runtime: RuntimeSession,
  services: WebApiServices,
) {
  return {
    projectId,
    name: runtime.metadata.name ?? projectNameFromId(projectId),
    starred: runtime.metadata.starred ?? false,
    previewUrl: addRevision(runtime.url),
    template: runtime.metadata.template,
    routes: runtime.metadata.routes,
    session: services.readSession ? await services.readSession(projectId) : null,
    conversation: services.readConversation ? await services.readConversation(projectId) : null,
  };
}

export function createDefaultWebApiServices(
  generatedRoot = path.resolve(process.cwd(), 'generated'),
): WebApiServices {
  return {
    async listProjects() {
      return listManagedProjects(generatedRoot);
    },

    async generate(prompt) {
      const result = await generateProject(prompt);
      const id = path.basename(result.outputDirectory);
      return {
        id,
        name: projectNameFromId(id),
        summary: result.project.summary,
        model: result.model,
        template: result.project.template,
        routes: result.project.routes,
        session: await readProjectSession(result.outputDirectory),
        conversation: await readProjectConversation(result.outputDirectory),
      };
    },

    async edit(projectId, prompt) {
      const result = await editGeneratedProject(projectId, prompt);
      await touchManagedProject(projectId, generatedRoot);
      return {
        projectId: result.projectId,
        summary: result.summary,
        model: result.model,
        changedFiles: result.changedFiles,
        session: result.session,
        conversation: await readProjectConversation(result.projectDirectory),
      };
    },

    async startRuntime(projectId) {
      const project = await resolveGeneratedProject(projectId, generatedRoot);
      const metadata = await readProjectMetadata(project.directory);
      const started = await startGeneratedProject(project, { port: 0 });
      return {
        url: started.url,
        metadata,
        isAlive: () => Boolean(started.server.httpServer?.listening),
        close: async () => {
          await started.server.close();
        },
      };
    },

    async readSession(projectId) {
      const project = await resolveGeneratedProject(projectId, generatedRoot);
      return readProjectSession(project.directory);
    },

    async readConversation(projectId) {
      const project = await resolveGeneratedProject(projectId, generatedRoot);
      return readProjectConversation(project.directory);
    },

    async updateProject(projectId, patch) {
      return updateManagedProject(projectId, patch, generatedRoot);
    },

    async remixProject(projectId) {
      return remixManagedProject(projectId, generatedRoot);
    },

    async deleteProject(projectId) {
      await deleteManagedProject(projectId, generatedRoot);
    },
  };
}

export function createYakableApiServer(options: { services?: WebApiServices } = {}): YakableApiServer {
  const services = options.services ?? createDefaultWebApiServices();
  const runtimes = new Map<string, RuntimeSession>();

  async function ensureRuntime(projectId: string): Promise<RuntimeSession> {
    const current = runtimes.get(projectId);
    if (current?.isAlive()) return current;
    if (current) {
      await current.close().catch(() => undefined);
      runtimes.delete(projectId);
    }

    const runtime = await services.startRuntime(projectId);
    runtimes.set(projectId, runtime);
    return runtime;
  }

  async function closeRuntime(projectId: string): Promise<void> {
    const runtime = runtimes.get(projectId);
    if (!runtime) return;
    await runtime.close().catch(() => undefined);
    runtimes.delete(projectId);
  }

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const method = request.method ?? 'GET';

      if (method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, { ok: true, storage: 'sqlite' });
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

      const projectBaseRoute = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
      if (projectBaseRoute) {
        const projectId = assertProjectId(projectBaseRoute[1] ?? '');

        if (method === 'PATCH') {
          if (!services.updateProject) throw new Error('Project updates are not available.');
          const body = await readJsonBody(request);
          sendJson(response, 200, { project: await services.updateProject(projectId, readProjectUpdate(body)) });
          return;
        }

        if (method === 'DELETE') {
          if (!services.deleteProject) throw new Error('Project deletion is not available.');
          await closeRuntime(projectId);
          await services.deleteProject(projectId);
          sendJson(response, 200, { ok: true, projectId });
          return;
        }
      }

      const remixRoute = url.pathname.match(/^\/api\/projects\/([^/]+)\/remix$/);
      if (method === 'POST' && remixRoute) {
        if (!services.remixProject) throw new Error('Project remix is not available.');
        const projectId = assertProjectId(remixRoute[1] ?? '');
        sendJson(response, 201, { project: await services.remixProject(projectId) });
        return;
      }

      const projectRoute = url.pathname.match(/^\/api\/projects\/([^/]+)\/(runtime|edit)$/);
      if (method === 'POST' && projectRoute) {
        const projectId = assertProjectId(projectRoute[1] ?? '');
        const action = projectRoute[2];

        if (action === 'runtime') {
          const runtime = await ensureRuntime(projectId);
          sendJson(response, 200, await runtimePayload(projectId, runtime, services));
          return;
        }

        const body = await readJsonBody(request);
        const edit = await services.edit(projectId, readPrompt(body));
        const runtime = await ensureRuntime(projectId);
        sendJson(response, 200, {
          ...(await runtimePayload(projectId, runtime, services)),
          ...edit,
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
      if (!address) throw new Error('Yakable API started without a network address.');
      return `http://${host}:${address.port}`;
    },
    async close() {
      await Promise.all([...runtimes.values()].map((runtime) => runtime.close().catch(() => undefined)));
      runtimes.clear();

      if (!server.listening) return;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
