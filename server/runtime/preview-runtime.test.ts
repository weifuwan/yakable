import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import type { ViteDevServer } from 'vite';

import { ensureProject, writeProjectFile } from '../project/project-store.js';
import { PreviewRuntimeManager } from './preview-runtime.js';

function fakeViteServer(
  onInvalidate: () => void,
  onClose: () => void,
  onTransform: (url: string) => Promise<unknown> = async () => ({ code: '' }),
) {
  return {
    moduleGraph: {
      invalidateAll: onInvalidate,
    },
    async transformRequest(url: string) {
      return onTransform(url);
    },
    middlewares() {
      throw new Error('Preview middleware is not exercised in this unit test');
    },
    async close() {
      onClose();
    },
  } as unknown as ViteDevServer;
}

test('syncProject materializes source, validates modules, and reuses the fixed Vite runtime', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'yakable-preview-runtime-'));
  const projectId = 'project_runtime_sync_test';
  let createCount = 0;
  let invalidateCount = 0;
  let closeCount = 0;
  let transformCount = 0;

  const manager = new PreviewRuntimeManager({
    rootDir,
    repositoryRoot: process.cwd(),
    createServer: async () => {
      createCount += 1;
      return fakeViteServer(
        () => {
          invalidateCount += 1;
        },
        () => {
          closeCount += 1;
        },
        async () => {
          transformCount += 1;
          return { code: '' };
        },
      );
    },
  });

  ensureProject(projectId);
  writeProjectFile(projectId, 'src/App.tsx', 'export default function App(){return <main>one</main>}');

  const first = await manager.syncProject(projectId);
  assert.equal(first.status, 'ready');
  assert.equal(first.revision, 1);
  assert.equal(createCount, 1);
  assert.ok(transformCount >= 3);
  assert.match(first.previewUrl ?? '', new RegExp(`/preview/${projectId}/`));
  assert.match(
    await readFile(join(rootDir, projectId, 'src/App.tsx'), 'utf8'),
    /one/,
  );

  writeProjectFile(projectId, 'src/App.tsx', 'export default function App(){return <main>two</main>}');
  const second = await manager.syncProject(projectId);

  assert.equal(second.status, 'ready');
  assert.equal(second.revision, 2);
  assert.equal(createCount, 1);
  assert.equal(invalidateCount, 1);
  assert.match(
    await readFile(join(rootDir, projectId, 'src/App.tsx'), 'utf8'),
    /two/,
  );

  await manager.disposeAll();
  assert.equal(closeCount, 1);
  await rm(rootDir, { recursive: true, force: true });
});

test('syncProject reports runtime startup errors without losing generated source', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'yakable-preview-runtime-error-'));
  const projectId = 'project_runtime_error_test';

  const manager = new PreviewRuntimeManager({
    rootDir,
    createServer: async () => {
      throw new Error('synthetic vite startup failure');
    },
  });

  ensureProject(projectId);
  const snapshot = await manager.syncProject(projectId);

  assert.equal(snapshot.status, 'error');
  assert.match(snapshot.error ?? '', /synthetic vite startup failure/);
  assert.match(
    await readFile(join(rootDir, projectId, 'src/App.tsx'), 'utf8'),
    /Describe what you want to build/,
  );

  await manager.disposeAll();
  await rm(rootDir, { recursive: true, force: true });
});

test('syncProject turns Vite transform failures into actionable runtime errors', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'yakable-preview-validation-'));
  const projectId = 'project_runtime_validation_test';

  const manager = new PreviewRuntimeManager({
    rootDir,
    createServer: async () =>
      fakeViteServer(
        () => undefined,
        () => undefined,
        async (url) => {
          if (url === '/src/App.tsx') {
            const error = new Error('Unexpected token');
            Object.assign(error, {
              id: join(rootDir, projectId, 'src/App.tsx'),
              loc: { line: 2, column: 10 },
              frame: '1 | export default function App() {\n2 |   return <main>broken\n  |          ^',
            });
            throw error;
          }
          return { code: '' };
        },
      ),
  });

  ensureProject(projectId);
  const snapshot = await manager.syncProject(projectId);

  assert.equal(snapshot.status, 'error');
  assert.equal(snapshot.revision, 0);
  assert.match(snapshot.error ?? '', /Unexpected token/);
  assert.match(snapshot.error ?? '', /Location: 2:10/);
  assert.match(snapshot.error ?? '', /<project>/);
  assert.doesNotMatch(snapshot.error ?? '', new RegExp(rootDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  await manager.disposeAll();
  await rm(rootDir, { recursive: true, force: true });
});
