import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import type {
  AgentClientToolResult,
  UnifiedEditRunResult,
} from '../agent-runtime/edit-run.js';
import { createPersistedAgentRecorder } from '../agent-runtime/persisted-recorder.js';
import type { AgentProtocolItem } from '../protocol/agent-protocol.js';
import type { ProjectUpdate } from '../projects/project-actions.js';
import { completeAgentRun, readAgentRun } from '../storage/agent-run.js';
import type { BuildIntentDecision } from '../types.js';
import {
  createDefaultWebApiServices,
  projectNameFromId,
} from './project-services.js';
import type {
  RuntimeSession,
  WebApiServices,
  WebCreateProjectBootstrap,
  WebGeneratedProject,
} from './web-api-contract.js';

export { createDefaultWebApiServices } from './project-services.js';
export type {
  RuntimeSession,
  WebApiServices,
  WebCreateProjectBootstrap,
  WebCreateProjectReservation,
  WebCreateProjectStatus,
  WebGeneratedProject,
  WebProjectListItem,
  WebProjectMessageResult,
} from './web-api-contract.js';

const DEFAULT_API_HOST = '127.0.0.1';
const DEFAULT_API_PORT = 8787;
const MAX_JSON_BODY_BYTES = 512_000;
const PROJECT_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

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

function readClientToolResult(body: Record<string, unknown>): AgentClientToolResult {
  if (typeof body.toolCallId !== 'string' || !body.toolCallId.trim()) {
    throw new Error('Client tool result requires toolCallId.');
  }
  if (body.toolName !== 'observe_preview') {
    throw new Error('Client tool result must target observe_preview.');
  }
  if (body.status === 'COMPLETED') {
    if (!('output' in body)) throw new Error('Completed client tool result requires output.');
    return {
      toolCallId: body.toolCallId.trim(),
      toolName: 'observe_preview',
      status: 'COMPLETED',
      output: body.output,
    };
  }
  if (body.status === 'FAILED') {
    if (typeof body.error !== 'string' || !body.error.trim()) {
      throw new Error('Failed client tool result requires error.');
    }
    return {
      toolCallId: body.toolCallId.trim(),
      toolName: 'observe_preview',
      status: 'FAILED',
      error: body.error.trim().slice(0, 2_000),
    };
  }
  throw new Error('Client tool result status must be COMPLETED or FAILED.');
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(value));
}

function startNdjson(response: ServerResponse): void {
  response.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
}

function writeNdjson(response: ServerResponse, value: unknown): void {
  response.write(`${JSON.stringify(value)}\n`);
}

function isClientError(error: Error): boolean {
  return /required|invalid|too large|too long|does not exist|missing|must|not valid json|pending|waiting|unsupported/i.test(
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

export function createYakableApiServer(options: { services?: WebApiServices } = {}): YakableApiServer {
  const services = options.services ?? createDefaultWebApiServices();
  const runtimes = new Map<string, RuntimeSession>();
  const backgroundCreates = new Map<string, Promise<void>>();

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

  async function ensureGeneratedRuntime(
    project: WebGeneratedProject,
    onAgentItem?: (item: AgentProtocolItem) => void,
  ): Promise<RuntimeSession> {
    if (!project.agentRunId) return ensureRuntime(project.id);

    const agent = createPersistedAgentRecorder(project.agentRunId, onAgentItem);
    agent.progress('RUNTIME', 'ACTIVE', 'Starting the generated project runtime');
    try {
      const runtime = await ensureRuntime(project.id);
      agent.progress('RUNTIME', 'COMPLETED', 'Generated project runtime is ready');
      const failed = readAgentRun(project.agentRunId)?.status === 'FAILED';
      agent.progress(
        'DONE',
        failed ? 'FAILED' : 'COMPLETED',
        failed
          ? 'Create pipeline finished with project health issues'
          : 'Create pipeline completed successfully',
      );
      completeAgentRun(project.agentRunId, { model: project.model, summary: project.summary });
      return runtime;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      agent.progress('RUNTIME', 'FAILED', `Runtime failed to start: ${message}`);
      agent.progress('DONE', 'FAILED', 'Create pipeline stopped before runtime was ready');
      completeAgentRun(project.agentRunId, { model: project.model, summary: project.summary });
      throw error;
    }
  }

  function launchBackgroundCreate(
    prompt: string,
    decision: BuildIntentDecision,
    bootstrap: WebCreateProjectBootstrap,
  ): void {
    const projectId = bootstrap.project.id;
    if (backgroundCreates.has(projectId)) return;

    const task = (async () => {
      const project = await services.generate(
        prompt,
        decision,
        undefined,
        bootstrap.reservation,
      );
      if (project.id !== projectId) {
        throw new Error(
          `Async create returned project ${project.id}, expected reserved project ${projectId}.`,
        );
      }
      await ensureGeneratedRuntime(project);
    })()
      .catch((error) => {
        const normalized = error instanceof Error ? error : new Error(String(error));
        console.error(`[Yakable API] Background create failed for ${projectId}.`, normalized);
      })
      .finally(() => {
        backgroundCreates.delete(projectId);
      });

    backgroundCreates.set(projectId, task);
  }

  async function closeRuntime(projectId: string): Promise<void> {
    const runtime = runtimes.get(projectId);
    if (!runtime) return;
    await runtime.close().catch(() => undefined);
    runtimes.delete(projectId);
  }

  async function editRunPayload(result: UnifiedEditRunResult) {
    const runtime = await ensureRuntime(result.projectId);
    return {
      ...(await runtimePayload(result.projectId, runtime, services)),
      ...result,
    };
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

      if (method === 'POST' && url.pathname === '/api/projects/bootstrap') {
        const body = await readJsonBody(request);
        const prompt = readPrompt(body);
        const decision = await services.gateBuildIntent(prompt);

        if (decision.route !== 'CREATE') {
          sendJson(response, 200, {
            accepted: false,
            decision,
          });
          return;
        }
        if (!services.bootstrapCreate) {
          throw new Error('Async project bootstrap is not available.');
        }

        const bootstrap = await services.bootstrapCreate(prompt, decision);
        sendJson(response, 202, {
          accepted: true,
          decision,
          project: bootstrap.project,
          run: bootstrap.run,
        });
        launchBackgroundCreate(prompt, decision, bootstrap);
        return;
      }

      if (method === 'POST' && url.pathname === '/api/projects/agent-create') {
        const body = await readJsonBody(request);
        const prompt = readPrompt(body);
        startNdjson(response);
        try {
          const decision = await services.gateBuildIntent(prompt);
          const project = await services.generate(prompt, decision, (item) => {
            writeNdjson(response, { type: 'agent-item', item });
          });
          const runtime = await ensureGeneratedRuntime(project, (item) => {
            writeNdjson(response, { type: 'agent-item', item });
          });
          writeNdjson(response, {
            type: 'result',
            result: { decision, project, previewUrl: addRevision(runtime.url) },
          });
        } catch (error) {
          const normalized = error instanceof Error ? error : new Error('Unknown create agent failure.');
          writeNdjson(response, { type: 'error', error: normalized.message });
        }
        response.end();
        return;
      }

      if (method === 'POST' && url.pathname === '/api/projects') {
        const body = await readJsonBody(request);
        const prompt = readPrompt(body);
        const decision = await services.gateBuildIntent(prompt);
        const project = await services.generate(prompt, decision);
        const runtime = await ensureGeneratedRuntime(project);
        sendJson(response, 201, { decision, project, previewUrl: addRevision(runtime.url) });
        return;
      }

      const continuationRoute = url.pathname.match(/^\/api\/agent-runs\/([^/]+)\/client-tool-result$/);
      if (method === 'POST' && continuationRoute) {
        const runId = decodeURIComponent(continuationRoute[1] ?? '').trim();
        if (!runId) throw new Error('Agent run id is required.');
        const body = await readJsonBody(request);
        startNdjson(response);
        try {
          const result = await services.continueEditRun(
            runId,
            readClientToolResult(body),
            (item) => writeNdjson(response, { type: 'agent-item', item }),
          );
          writeNdjson(response, {
            type: result.status === 'WAITING_FOR_CLIENT_TOOL' ? 'await-client-tool' : 'result',
            result: await editRunPayload(result),
          });
        } catch (error) {
          const normalized = error instanceof Error ? error : new Error('Unknown Agent continuation failure.');
          writeNdjson(response, { type: 'error', error: normalized.message });
        }
        response.end();
        return;
      }

      const creationStatusRoute = url.pathname.match(/^\/api\/projects\/([^/]+)\/creation$/);
      if (method === 'GET' && creationStatusRoute) {
        if (!services.readCreateStatus) {
          throw new Error('Async project creation status is not available.');
        }
        const projectId = assertProjectId(creationStatusRoute[1] ?? '');
        const status = await services.readCreateStatus(projectId);
        if (!status) {
          sendJson(response, 404, { error: `Project creation state does not exist: ${projectId}` });
          return;
        }
        sendJson(response, 200, status);
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

      const projectRoute = url.pathname.match(/^\/api\/projects\/([^/]+)\/(runtime|message|agent-edit)$/);
      if (method === 'POST' && projectRoute) {
        const projectId = assertProjectId(projectRoute[1] ?? '');
        const action = projectRoute[2];
        if (action === 'runtime') {
          const runtime = await ensureRuntime(projectId);
          sendJson(response, 200, await runtimePayload(projectId, runtime, services));
          return;
        }

        const body = await readJsonBody(request);
        if (action === 'message') {
          if (!services.message) throw new Error('Project message routing is not available.');
          sendJson(response, 200, await services.message(projectId, readPrompt(body)));
          return;
        }

        const prompt = readPrompt(body);
        startNdjson(response);
        try {
          let runId = '';
          const result = await services.beginEditRun(
            projectId,
            prompt,
            (createdRunId) => {
              runId = createdRunId;
              writeNdjson(response, { type: 'run-started', runId: createdRunId });
            },
            (item) => writeNdjson(response, { type: 'agent-item', item }),
          );
          if (!runId) writeNdjson(response, { type: 'run-started', runId: result.runId });
          writeNdjson(response, {
            type: result.status === 'WAITING_FOR_CLIENT_TOOL' ? 'await-client-tool' : 'result',
            result: await editRunPayload(result),
          });
        } catch (error) {
          const normalized = error instanceof Error ? error : new Error('Unknown agent edit failure.');
          writeNdjson(response, { type: 'error', error: normalized.message });
        }
        response.end();
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
