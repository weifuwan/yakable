import assert from 'node:assert/strict';
import test from 'node:test';

import { MockProvider } from '../ai/mock-provider.js';
import { ensureProject, readProjectFile, writeProjectFile } from '../project/project-store.js';
import type { PreviewRuntimeSnapshot } from '../runtime/preview-runtime.js';
import { repairPreviewIfNeeded, type RuntimeSyncer } from './auto-repair.js';

test('automatic repair feeds a runtime error back into the Agent and validates again', async () => {
  const projectId = 'project_auto_repair_test';
  ensureProject(projectId);
  writeProjectFile(
    projectId,
    'src/App.tsx',
    'export default function App() { return __YAKABLE_BROKEN_JSX__; }',
  );

  let syncCount = 0;
  const runtimeSyncer: RuntimeSyncer = {
    async syncProject(): Promise<PreviewRuntimeSnapshot> {
      syncCount += 1;
      return {
        projectId,
        status: 'ready',
        revision: 1,
        previewUrl: `/preview/${projectId}/?revision=1`,
      };
    },
  };

  const result = await repairPreviewIfNeeded(
    new MockProvider(),
    runtimeSyncer,
    projectId,
    {
      projectId,
      status: 'error',
      revision: 0,
      error: 'Unexpected identifier __YAKABLE_BROKEN_JSX__ in src/App.tsx',
    },
  );

  assert.equal(result.repair.attempted, true);
  assert.equal(result.repair.attempts, 1);
  assert.equal(result.repair.succeeded, true);
  assert.deepEqual(result.repair.changedFiles, ['src/App.tsx']);
  assert.equal(syncCount, 1);
  assert.doesNotMatch(
    readProjectFile(projectId, 'src/App.tsx').content,
    /__YAKABLE_BROKEN_JSX__/,
  );
});

test('automatic repair is bounded to two attempts', async () => {
  const projectId = 'project_auto_repair_bound_test';
  ensureProject(projectId);
  writeProjectFile(
    projectId,
    'src/App.tsx',
    'export default function App() { return __YAKABLE_BROKEN_JSX__; }',
  );

  let syncCount = 0;
  const runtimeSyncer: RuntimeSyncer = {
    async syncProject(): Promise<PreviewRuntimeSnapshot> {
      syncCount += 1;
      return {
        projectId,
        status: 'error',
        revision: 0,
        error: `synthetic validation failure ${syncCount}`,
      };
    },
  };

  const result = await repairPreviewIfNeeded(
    new MockProvider(),
    runtimeSyncer,
    projectId,
    {
      projectId,
      status: 'error',
      revision: 0,
      error: 'initial synthetic validation failure',
    },
  );

  assert.equal(result.repair.attempted, true);
  assert.equal(result.repair.attempts, 2);
  assert.equal(result.repair.succeeded, false);
  assert.equal(syncCount, 2);
});
