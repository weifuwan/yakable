import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, resolve, sep } from 'node:path';

import {
  createServer as createViteServer,
  type InlineConfig,
  type ViteDevServer,
} from 'vite';

import { getProjectSnapshot, readProjectFile } from '../project/project-store.js';

const DEFAULT_MAX_ACTIVE_RUNTIMES = 6;
const DEFAULT_IDLE_TTL_MS = 30 * 60 * 1000;
const MAX_RUNTIME_ERROR_LENGTH = 12000;
const VALIDATABLE_SOURCE_RE = /\.(?:[cm]?[jt]sx?|css|json)$/i;

export type PreviewRuntimeStatus = 'starting' | 'ready' | 'error' | 'stopped';

export interface PreviewRuntimeSnapshot {
  projectId: string;
  status: PreviewRuntimeStatus;
  revision: number;
  previewUrl?: string;
  startedAt?: string;
  updatedAt?: string;
  error?: string;
}

interface RuntimeEntry {
  projectId: string;
  rootDir: string;
  status: PreviewRuntimeStatus;
  revision: number;
  startedAt?: number;
  updatedAt: number;
  error?: string;
  vite?: ViteDevServer;
  syncQueue: Promise<void>;
}

type ViteServerFactory = (config: InlineConfig) => Promise<ViteDevServer>;

export interface PreviewRuntimeManagerOptions {
  rootDir?: string;
  repositoryRoot?: string;
  maxActiveRuntimes?: number;
  idleTtlMs?: number;
  createServer?: ViteServerFactory;
  now?: () => number;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Preview runtime failed';
}

function formatRuntimeError(error: unknown, projectRoot: string) {
  const parts = [errorMessage(error)];

  if (typeof error === 'object' && error !== null) {
    const detail = error as {
      id?: unknown;
      frame?: unknown;
      loc?: { line?: unknown; column?: unknown } | unknown;
    };

    if (typeof detail.id === 'string') {
      parts.push(`File: ${detail.id}`);
    }

    if (detail.loc && typeof detail.loc === 'object') {
      const loc = detail.loc as { line?: unknown; column?: unknown };
      if (typeof loc.line === 'number') {
        parts.push(
          `Location: ${loc.line}${
            typeof loc.column === 'number' ? `:${loc.column}` : ''
          }`,
        );
      }
    }

    if (typeof detail.frame === 'string' && detail.frame.trim()) {
      parts.push(detail.frame.trim());
    }
  }

  return parts
    .filter(Boolean)
    .join('\n')
    .replaceAll(resolve(projectRoot), '<project>')
    .slice(0, MAX_RUNTIME_ERROR_LENGTH);
}

function htmlError(response: ServerResponse, status: number, message: string) {
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(`<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;min-height:100vh;display:grid;place-items:center;font-family:ui-sans-serif,system-ui;background:#fafafa;color:#3f3f46">
    <main style="max-width:560px;padding:32px;text-align:center">
      <strong style="display:block;color:#18181b">Preview unavailable</strong>
      <p style="font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(message)}</p>
    </main>
  </body>
</html>`);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function assertProjectRuntimePath(rootDir: string, projectId: string) {
  const projectRoot = resolve(rootDir, projectId);
  const prefix = `${resolve(rootDir)}${sep}`;

  if (!projectRoot.startsWith(prefix)) {
    throw new Error('Invalid preview runtime project path');
  }

  return projectRoot;
}

function assertFilePath(projectRoot: string, projectPath: string) {
  const filePath = resolve(projectRoot, projectPath);
  const prefix = `${resolve(projectRoot)}${sep}`;

  if (!filePath.startsWith(prefix)) {
    throw new Error(`Invalid runtime file path: ${projectPath}`);
  }

  return filePath;
}

export class PreviewRuntimeManager {
  private readonly rootDir: string;
  private readonly repositoryRoot: string;
  private readonly maxActiveRuntimes: number;
  private readonly idleTtlMs: number;
  private readonly createServer: ViteServerFactory;
  private readonly now: () => number;
  private readonly runtimes = new Map<string, RuntimeEntry>();

  constructor(options: PreviewRuntimeManagerOptions = {}) {
    this.rootDir = resolve(
      options.rootDir ?? process.env.YAKABLE_RUNTIME_ROOT ?? '.yakable/runtime',
    );
    this.repositoryRoot = resolve(options.repositoryRoot ?? process.cwd());
    this.maxActiveRuntimes = options.maxActiveRuntimes ?? DEFAULT_MAX_ACTIVE_RUNTIMES;
    this.idleTtlMs = options.idleTtlMs ?? DEFAULT_IDLE_TTL_MS;
    this.createServer = options.createServer ?? createViteServer;
    this.now = options.now ?? Date.now;
  }

  getSnapshot(projectId: string): PreviewRuntimeSnapshot {
    const entry = this.runtimes.get(projectId);

    if (!entry) {
      return {
        projectId,
        status: 'stopped',
        revision: 0,
      };
    }

    return this.snapshot(entry);
  }

  async syncProject(projectId: string): Promise<PreviewRuntimeSnapshot> {
    await this.sweepIdleRuntimes(projectId);

    let entry = this.runtimes.get(projectId);
    if (!entry) {
      const now = this.now();
      entry = {
        projectId,
        rootDir: assertProjectRuntimePath(this.rootDir, projectId),
        status: 'starting',
        revision: 0,
        updatedAt: now,
        syncQueue: Promise.resolve(),
      };
      this.runtimes.set(projectId, entry);
    }

    const currentEntry = entry;
    currentEntry.syncQueue = currentEntry.syncQueue.then(async () => {
      await this.syncEntry(currentEntry);
    });
    await currentEntry.syncQueue;

    return this.snapshot(currentEntry);
  }

  async handlePreviewRequest(
    request: IncomingMessage,
    response: ServerResponse,
    projectId: string,
  ) {
    let entry = this.runtimes.get(projectId);

    if (!entry) {
      await this.syncProject(projectId);
      entry = this.runtimes.get(projectId);
    }

    if (!entry || entry.status !== 'ready' || !entry.vite) {
      const detail = entry?.error ?? 'The generated project runtime is not ready yet.';
      htmlError(response, 503, detail);
      return;
    }

    entry.updatedAt = this.now();
    this.setPreviewSecurityHeaders(response);

    entry.vite.middlewares(request, response, (error) => {
      if (response.writableEnded) {
        return;
      }

      if (error) {
        entry.status = 'error';
        entry.error = formatRuntimeError(error, entry.rootDir);
        entry.updatedAt = this.now();
        htmlError(response, 500, entry.error);
        return;
      }

      htmlError(response, 404, 'Preview asset not found.');
    });
  }

  async disposeAll() {
    await Promise.all([...this.runtimes.keys()].map((projectId) => this.stopRuntime(projectId)));
  }

  private async syncEntry(entry: RuntimeEntry) {
    entry.status = 'starting';
    entry.error = undefined;
    entry.updatedAt = this.now();

    try {
      await this.materializeProject(entry.projectId, entry.rootDir);

      if (!entry.vite) {
        entry.vite = await this.createServer({
          root: entry.rootDir,
          base: `/preview/${entry.projectId}/`,
          appType: 'spa',
          clearScreen: false,
          logLevel: 'silent',
          cacheDir: resolve(entry.rootDir, '.vite-cache'),
          server: {
            middlewareMode: true,
            hmr: false,
            cors: true,
            fs: {
              strict: true,
              allow: [entry.rootDir, resolve(this.repositoryRoot, 'node_modules')],
            },
          },
        });
        entry.startedAt = this.now();
      } else {
        entry.vite.moduleGraph.invalidateAll();
      }

      await this.validateGeneratedModules(entry);

      entry.revision += 1;
      entry.status = 'ready';
      entry.updatedAt = this.now();
    } catch (error) {
      entry.status = 'error';
      entry.error = formatRuntimeError(error, entry.rootDir);
      entry.updatedAt = this.now();
    }
  }

  private async validateGeneratedModules(entry: RuntimeEntry) {
    if (!entry.vite) {
      throw new Error('Preview Vite runtime is unavailable during validation');
    }

    const sourceFiles = getProjectSnapshot(entry.projectId).files
      .map((file) => file.path)
      .filter((path) => path.startsWith('src/') && VALIDATABLE_SOURCE_RE.test(path))
      .sort();

    for (const path of sourceFiles) {
      const result = await entry.vite.transformRequest(`/${path}`);
      if (!result) {
        throw new Error(`Vite could not validate generated module: ${path}`);
      }
    }
  }

  private async materializeProject(projectId: string, projectRoot: string) {
    await mkdir(projectRoot, { recursive: true });
    await this.ensureSharedDependencies(projectRoot);

    const snapshot = getProjectSnapshot(projectId);

    for (const fileSummary of snapshot.files) {
      const file = readProjectFile(projectId, fileSummary.path);
      const filePath = assertFilePath(projectRoot, file.path);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, file.content, 'utf8');
    }
  }

  private async ensureSharedDependencies(projectRoot: string) {
    const target = resolve(this.repositoryRoot, 'node_modules');
    const link = resolve(projectRoot, 'node_modules');

    try {
      await symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : undefined;

      if (code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private snapshot(entry: RuntimeEntry): PreviewRuntimeSnapshot {
    return {
      projectId: entry.projectId,
      status: entry.status,
      revision: entry.revision,
      previewUrl:
        entry.status === 'ready'
          ? `/preview/${entry.projectId}/?revision=${entry.revision}`
          : undefined,
      startedAt: entry.startedAt ? new Date(entry.startedAt).toISOString() : undefined,
      updatedAt: new Date(entry.updatedAt).toISOString(),
      error: entry.error,
    };
  }

  private async sweepIdleRuntimes(activeProjectId: string) {
    const now = this.now();
    const staleIds = [...this.runtimes.values()]
      .filter(
        (entry) =>
          entry.projectId !== activeProjectId && now - entry.updatedAt > this.idleTtlMs,
      )
      .map((entry) => entry.projectId);

    await Promise.all(staleIds.map((projectId) => this.stopRuntime(projectId)));

    if (this.runtimes.has(activeProjectId) || this.runtimes.size < this.maxActiveRuntimes) {
      return;
    }

    const oldest = [...this.runtimes.values()]
      .filter((entry) => entry.projectId !== activeProjectId)
      .sort((a, b) => a.updatedAt - b.updatedAt)[0];

    if (oldest) {
      await this.stopRuntime(oldest.projectId);
    }
  }

  private async stopRuntime(projectId: string) {
    const entry = this.runtimes.get(projectId);
    if (!entry) {
      return;
    }

    this.runtimes.delete(projectId);
    entry.status = 'stopped';

    try {
      await entry.vite?.close();
    } finally {
      await rm(entry.rootDir, { recursive: true, force: true });
    }
  }

  private setPreviewSecurityHeaders(response: ServerResponse) {
    response.setHeader('cache-control', 'no-store');
    response.setHeader('access-control-allow-origin', '*');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader(
      'content-security-policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'self'",
      ].join('; '),
    );
  }
}
