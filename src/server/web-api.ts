import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  cancelUnifiedEditRun,
  type AgentClientToolResult,
  type UnifiedEditRunResult,
} from '../agent-runtime/edit-run.js';
import { createPersistedAgentRecorder } from '../agent-runtime/persisted-recorder.js';
import {
  isOperationCancelled,
  OperationCancelledError,
  withOperationCancellation,
} from '../operation-cancellation.js';
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
  WebCreateProjectStatus,
  WebGeneratedProject,
} from './web-api-contract.js';

export { createDefaultWebApiServices } from './project-services.js';
export type {
  RuntimeSession,
  WebApiServices,
  WebCreateProjectBootstrap,
  WebCreateProjectReservation,
  WebCreateProjectStatus,
  WebCreateRecoveryResult,
  WebGeneratedProject,
  WebProjectListItem,
  WebProjectMessageResult,
} from './web-api-contract.js';

const DEFAULT_API_HOST = '127.0.0.1';
const DEFAULT_API_PORT = 8787;
const MAX_JSON_BODY_BYTES = 512_000;
const PROJECT_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

type RuntimePayload = Awaited<ReturnType<typeof runtimePayload>>;

type CreationStreamRecord =
  | { type: 'snapshot'; status: WebCreateProjectStatus }
  | { type: 'agent-item'; runId: string; item: AgentProtocolItem }
  | { type: 'ready'; runtime: RuntimePayload }
  | { type: 'failed'; error: string };

export interface YakableApiServer {
  server: Server;
  listen(port?: number, host?: string): Promise<string>;
  close(): Promise<void>;
}

interface RequestCancellation {
  signal: AbortSignal;
  dispose(): void;
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
  if (response.writableEnded || response.destroyed) return;
  response.write(`${JSON.stringify(value)}\n`);
}

function isClientError(error: Error): boolean {
  return /required|invalid|too large|too long|does not exist|missing|must|not valid json|pending|waiting|unsupported/i.test(
    error.message,
  );
}

function requestCancellation(
  request: IncomingMessage,
  response: ServerResponse,
): RequestCancellation {
  const controller = new AbortController();
  const abort = () => {
    if (controller.signal.aborted || response.writableEnded) return;
    controller.abort(new OperationCancelledError());
  };
  const onRequestAborted = () => abort();
  const onResponseClose = () => abort();

  request.once('aborted', onRequestAborted);
  response.once('close', onResponseClose);
  if (request.aborted || response.destroyed) abort();

  return {
    signal: controller.signal,
    dispose() {
      request.off('aborted', onRequestAborted);
      response.off('close', onResponseClose);
    },
  };
}

function addRevision(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}revision=${Date.now()}`;
}

function creationStatusFromBootstrap(bootstrap: WebCreateProjectBootstrap): WebCreateProjectStatus {
  return {
    project: {
      ...bootstrap.project,
      activeRunId: bootstrap.run.id,
    },
    run: {
      ...bootstrap.run,
      items: [],
    },
  };
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
  const creationSubscribers = new Map<string, Set<(record: CreationStreamRecord) => void>>();
  const creationStreamResponses = new Set<ServerResponse>();

  function publishCreationRecord(projectId: string, record: CreationStreamRecord): void {
    const subscribers = creationSubscribers.get(projectId);
    if (!subscribers?.size) return;
    for (const subscriber of [...subscribers]) subscriber(record);
  }

  function subscribeCreation(
    projectId: string,
    subscriber: (record: CreationStreamRecord) => void,
  ): () => void {
    const current = creationSubscribers.get(projectId) ?? new Set();
    current.add(subscriber);
    creationSubscribers.set(projectId, current);
    return () => {
      const subscribers = creationSubscribers.get(projectId);
      if (!subscribers) return;
      subscribers.delete(subscriber);
      if (subscribers.size === 0) creationSubscribers.delete(projectId);
    };
  }

  async function publishCreationSnapshot(projectId: string): Promise<WebCreateProjectStatus | null> {
    if (!services.readCreateStatus) return null;
    const status = await services.readCreateStatus(projectId);
    if (status) publishCreationRecord(projectId, { type: 'snapshot', status });
    return status;
  }

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

  async function recoverInterruptedRuntime(projectId: string): Promise<void> {
    if (!services.readCreateStatus) return;
    const status = await services.readCreateStatus(projectId);
    if (!status || status.project.status !== 'STARTING_RUNTIME') return;

    const runId = status.run?.id;
    const onAgentItem = (item: AgentProtocolItem) => {
      if (runId) publishCreationRecord(projectId, { type: 'agent-item', runId, item });
    };
    const agent = runId ? createPersistedAgentRecorder(runId, onAgentItem) : null;
    agent?.progress('RUNTIME', 'ACTIVE', 'Resuming the generated project runtime after restart');

    try {
      const runtime = await ensureRuntime(projectId);
      agent?.progress('RUNTIME', 'COMPLETED', 'Recovered the generated project runtime');
      agent?.progress('DONE', 'COMPLETED', 'Create pipeline recovered after restart');
      if (runId) {
        completeAgentRun(runId, {
          ...(status.run?.model ? { model: status.run.model } : {}),
          summary: status.run?.summary ?? 'Create pipeline recovered after restart.',
        });
      }
      await publishCreationSnapshot(projectId);
      publishCreationRecord(projectId, {
        type: 'ready',
        runtime: await runtimePayload(projectId, runtime, services),
      });
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      agent?.progress('RUNTIME', 'FAILED', `Runtime recovery failed: ${normalized.message}`);
      agent?.progress('DONE', 'FAILED', 'Create pipeline could not recover after restart');
      await publishCreationSnapshot(projectId).catch(() => null);
      publishCreationRecord(projectId, { type: 'failed', error: normalized.message });
      console.error(`[Yakable API] Runtime recovery failed for ${projectId}.`, normalized);
    }
  }

  function launchBackgroundCreate(
    prompt: string,
    decision: BuildIntentDecision,
    bootstrap: WebCreateProjectBootstrap,
  ): void {
    const projectId = bootstrap.project.id;
    const runId = bootstrap.run.id;
    if (backgroundCreates.has(projectId)) return;

    const onAgentItem = (item: AgentProtocolItem) => {
      publishCreationRecord(projectId, { type: 'agent-item', runId, item });
      void publishCreationSnapshot(projectId).catch((error) => {
        console.warn(`[Yakable API] Could not refresh create snapshot for ${projectId}.`, error);
      });
    };

    const task = (async () => {
      const project = await services.generate(
        prompt,
        decision,
        onAgentItem,
        bootstrap.reservation,
      );
      if (project.id !== projectId) {
        throw new Error(
          `Async create returned project ${project.id}, expected reserved project ${projectId}.`,
        );
      }
      const runtime = await ensureGeneratedRuntime(project, onAgentItem);
      await publishCreationSnapshot(projectId);
      publishCreationRecord(projectId, {
        type: 'ready',
        runtime: await runtimePayload(projectId, runtime, services),
      });
    })()
      .catch(async (error) => {
        const normalized = error instanceof Error ? error : new Error(String(error));
        console.error(`[Yakable API] Background create failed for ${projectId}.`, normalized);
        await publishCreationSnapshot(projectId).catch(() => null);
        publishCreationRecord(projectId, { type: 'failed', error: normalized.message });
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

        if (decision.route === 'CREATE') {
          if (!services.bootstrapCreate) {
            throw new Error('Async project bootstrap is not available.');
          }

          const bootstrap = await services.bootstrapCreate(prompt, decision);
          sendJson(response, 202, {
            decision,
            project: {
              id: bootstrap.project.id,
              name: bootstrap.project.name,
            },
            creation: creationStatusFromBootstrap(bootstrap),
          });
          launchBackgroundCreate(prompt, decision, bootstrap);
          return;
        }

        const project = await services.generate(prompt, decision);
        sendJson(response, 201, {
          decision,
          project: {
            id: project.id,
            name: project.name,
          },
          creation: null,
        });
        return;
      }

      const cancelRunRoute = url.pathname.match(/^\/api\/agent-runs\/([^/]+)\/cancel$/);
      if (method === 'POST' && cancelRunRoute) {
        const runId = decodeURIComponent(cancelRunRoute[1] ?? '').trim();
        if (!runId) throw new Error('Agent run id is required.');
        const cancelled = cancelUnifiedEditRun(runId);
        sendJson(response, 200, { ok: true, runId, cancelled });
        return;
      }

      const continuationRoute = url.pathname.match(/^\/api\/agent-runs\/([^/]+)\/client-tool-result$/);
      if (method === 'POST' && continuationRoute) {
        const runId = decodeURIComponent(continuationRoute[1] ?? '').trim();
        if (!runId) throw new Error('Agent run id is required.');
        const body = await readJsonBody(request);
        const cancellation = requestCancellation(request, response);
        startNdjson(response);
        try {
          const result = await withOperationCancellation(cancellation.signal, () =>
            services.continueEditRun(
              runId,
              readClientToolResult(body),
              (item) => writeNdjson(response, { type: 'agent-item', item }),
            ),
          );
          if (cancellation.signal.aborted) throw new OperationCancelledError();
          writeNdjson(response, {
            type: result.status === 'WAITING_FOR_CLIENT_TOOL' ? 'await-client-tool' : 'result',
            result: await editRunPayload(result),
          });
        } catch (error) {
          if (isOperationCancelled(error) || cancellation.signal.aborted) {
            cancelUnifiedEditRun(runId);
          } else {
            const normalized = error instanceof Error ? error : new Error('Unknown Agent continuation failure.');
            writeNdjson(response, { type: 'error', error: normalized.message });
          }
        } finally {
          cancellation.dispose();
          if (!response.writableEnded && !response.destroyed) response.end();
        }
        return;
      }

      const retryCreationRoute = url.pathname.match(/^\/api\/projects\/([^/]+)\/creation\/retry$/);
      if (method === 'POST' && retryCreationRoute) {
        if (!services.readCreateStatus || !services.bootstrapCreate) {
          throw new Error('Async project creation retry is not available.');
        }
        const projectId = assertProjectId(retryCreationRoute[1] ?? '');
        const previous = await services.readCreateStatus(projectId);
        if (!previous) {
          sendJson(response, 404, { error: `Project creation state does not exist: ${projectId}` });
          return;
        }
        if (previous.project.status !== 'FAILED') {
          sendJson(response, 409, {
            error: 'Only a failed project creation can be retried.',
            projectId,
            status: previous.project.status,
          });
          return;
        }

        const decision: BuildIntentDecision = {
          version: 1,
          route: 'CREATE',
          confidence: 'high',
          message: 'Retrying project creation.',
        };
        const bootstrap = await services.bootstrapCreate(previous.project.prompt, decision);
        sendJson(response, 202, {
          retryOf: projectId,
          decision,
          project: bootstrap.project,
          run: bootstrap.run,
        });
        launchBackgroundCreate(previous.project.prompt, decision, bootstrap);
        return;
      }

      const creationStreamRoute = url.pathname.match(/^\/api\/projects\/([^/]+)\/creation\/stream$/);
      if (method === 'GET' && creationStreamRoute) {
        if (!services.readCreateStatus) {
          throw new Error('Async project creation status is not available.');
        }
        const projectId = assertProjectId(creationStreamRoute[1] ?? '');
        const initial = await services.readCreateStatus(projectId);
        if (!initial) {
          sendJson(response, 404, { error: `Project creation state does not exist: ${projectId}` });
          return;
        }

        startNdjson(response);
        creationStreamResponses.add(response);
        let unsubscribe = () => undefined;
        let closed = false;

        const cleanup = () => {
          if (closed) return;
          closed = true;
          unsubscribe();
          creationStreamResponses.delete(response);
        };
        const finish = () => {
          cleanup();
          if (!response.writableEnded && !response.destroyed) response.end();
        };
        const send = (record: CreationStreamRecord) => {
          if (closed || response.writableEnded || response.destroyed) return;
          writeNdjson(response, record);
          if (record.type === 'ready' || record.type === 'failed') finish();
        };
        const sendTerminalIfNeeded = async (status: WebCreateProjectStatus): Promise<boolean> => {
          if (status.project.status === 'FAILED') {
            send({
              type: 'failed',
              error: status.project.failureMessage || 'Project creation failed.',
            });
            return true;
          }
          if (status.project.status === 'READY') {
            const runtime = await ensureRuntime(projectId);
            send({
              type: 'ready',
              runtime: await runtimePayload(projectId, runtime, services),
            });
            return true;
          }
          return false;
        };

        request.once('close', cleanup);
        send({ type: 'snapshot', status: initial });
        if (await sendTerminalIfNeeded(initial)) return;

        unsubscribe = subscribeCreation(projectId, send);
        const latest = await services.readCreateStatus(projectId);
        if (!latest) {
          send({ type: 'failed', error: `Project creation state disappeared: ${projectId}` });
          return;
        }
        if (latest.project.updatedAt !== initial.project.updatedAt || latest.run?.items.length !== initial.run?.items.length) {
          send({ type: 'snapshot', status: latest });
        }
        await sendTerminalIfNeeded(latest);
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
          const cancellation = requestCancellation(request, response);
          try {
            const result = await withOperationCancellation(cancellation.signal, () =>
              services.message!(projectId, readPrompt(body)),
            );
            if (cancellation.signal.aborted) throw new OperationCancelledError();
            if (!response.destroyed) sendJson(response, 200, result);
          } catch (error) {
            if (isOperationCancelled(error) || cancellation.signal.aborted) {
              if (!response.headersSent && !response.destroyed) {
                sendJson(response, 499, { error: 'Stopped by user.' });
              }
            } else {
              throw error;
            }
          } finally {
            cancellation.dispose();
          }
          return;
        }

        const prompt = readPrompt(body);
        const cancellation = requestCancellation(request, response);
        startNdjson(response);
        let runId = '';
        try {
          const result = await withOperationCancellation(cancellation.signal, () =>
            services.beginEditRun(
              projectId,
              prompt,
              (createdRunId) => {
                runId = createdRunId;
                writeNdjson(response, { type: 'run-started', runId: createdRunId });
              },
              (item) => writeNdjson(response, { type: 'agent-item', item }),
            ),
          );
          if (cancellation.signal.aborted) throw new OperationCancelledError();
          if (!runId) {
            runId = result.runId;
            writeNdjson(response, { type: 'run-started', runId: result.runId });
          }
          writeNdjson(response, {
            type: result.status === 'WAITING_FOR_CLIENT_TOOL' ? 'await-client-tool' : 'result',
            result: await editRunPayload(result),
          });
        } catch (error) {
          if (isOperationCancelled(error) || cancellation.signal.aborted) {
            if (runId) cancelUnifiedEditRun(runId);
          } else {
            const normalized = error instanceof Error ? error : new Error('Unknown agent edit failure.');
            writeNdjson(response, { type: 'error', error: normalized.message });
          }
        } finally {
          cancellation.dispose();
          if (!response.writableEnded && !response.destroyed) response.end();
        }
        return;
      }

      sendJson(response, 404, { error: 'Not found.' });
    } catch (error) {
      if (isOperationCancelled(error)) {
        if (!response.headersSent && !response.destroyed) {
          sendJson(response, 499, { error: 'Stopped by user.' });
        } else if (!response.writableEnded && !response.destroyed) {
          response.end();
        }
        return;
      }

      const normalized = error instanceof Error ? error : new Error('Unknown API failure.');
      console.error('[Yakable API]', normalized);
      if (!response.headersSent) {
        sendJson(response, isClientError(normalized) ? 400 : 500, { error: normalized.message });
      } else if (!response.writableEnded) {
        writeNdjson(response, { type: 'failed', error: normalized.message });
        response.end();
      }
    }
  });

  server.requestTimeout = 660_000;

  return {
    server,
    async listen(port = DEFAULT_API_PORT, host = DEFAULT_API_HOST) {
      if (services.reconcileInterruptedCreates) {
        const recovery = await services.reconcileInterruptedCreates();
        for (const projectId of recovery.runtimePendingProjectIds) {
          await recoverInterruptedRuntime(projectId);
        }
      }

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
      for (const response of [...creationStreamResponses]) {
        if (!response.writableEnded) response.end();
      }
      creationStreamResponses.clear();
      creationSubscribers.clear();
      await Promise.all([...runtimes.values()].map((runtime) => runtime.close().catch(() => undefined)));
      runtimes.clear();
      if (!server.listening) return;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
