import assert from 'node:assert/strict';
import test from 'node:test';

import type { AgentRuntime } from '../src/agent-runtime/agent-runtime.js';
import { createDefaultWebApiServices } from '../src/server/project-services.js';
import { readAgentRun } from '../src/storage/agent-run.js';
import { closeYakableDatabases } from '../src/storage/database.js';
import {
  beginProjectBuildLifecycle,
  readProjectLifecycle,
  transitionProjectLifecycle,
} from '../src/storage/project-lifecycle.js';

async function withMemoryDatabase(run: () => Promise<void> | void): Promise<void> {
  const previous = process.env.YAKABLE_DB_PATH;
  closeYakableDatabases();
  process.env.YAKABLE_DB_PATH = ':memory:';
  try {
    await run();
  } finally {
    closeYakableDatabases();
    if (previous === undefined) delete process.env.YAKABLE_DB_PATH;
    else process.env.YAKABLE_DB_PATH = previous;
  }
}

test('server-start reconciliation fails interrupted generation but preserves runtime recovery', async () => {
  await withMemoryDatabase(async () => {
    const creating = beginProjectBuildLifecycle({
      projectId: 'restart-creating',
      prompt: 'Build a landing page',
      createdAt: '2026-09-15T05:10:00.000Z',
    });
    const generating = beginProjectBuildLifecycle({
      projectId: 'restart-generating',
      prompt: 'Build a dashboard',
      createdAt: '2026-09-15T05:11:00.000Z',
    });
    transitionProjectLifecycle(generating.project.projectId, 'GENERATING', {
      updatedAt: '2026-09-15T05:11:01.000Z',
    });

    const runtimePending = beginProjectBuildLifecycle({
      projectId: 'restart-runtime',
      prompt: 'Build a pricing page',
      createdAt: '2026-09-15T05:12:00.000Z',
    });
    transitionProjectLifecycle(runtimePending.project.projectId, 'GENERATING', {
      updatedAt: '2026-09-15T05:12:01.000Z',
    });
    transitionProjectLifecycle(runtimePending.project.projectId, 'STARTING_RUNTIME', {
      updatedAt: '2026-09-15T05:12:02.000Z',
    });

    const services = createDefaultWebApiServices(
      '/tmp/yakable-create-recovery-test',
      {} as AgentRuntime,
    );
    const recovery = await services.reconcileInterruptedCreates?.();
    assert.ok(recovery);
    assert.deepEqual(
      new Set(recovery.failedProjectIds),
      new Set(['restart-creating', 'restart-generating']),
    );
    assert.deepEqual(recovery.runtimePendingProjectIds, ['restart-runtime']);

    const creatingAfter = readProjectLifecycle(creating.project.projectId);
    const generatingAfter = readProjectLifecycle(generating.project.projectId);
    const runtimeAfter = readProjectLifecycle(runtimePending.project.projectId);

    assert.equal(creatingAfter?.status, 'FAILED');
    assert.match(creatingAfter?.failureMessage ?? '', /interrupted.*restarted/i);
    assert.equal(generatingAfter?.status, 'FAILED');
    assert.match(generatingAfter?.failureMessage ?? '', /Retry the build/i);
    assert.equal(runtimeAfter?.status, 'STARTING_RUNTIME');

    assert.equal(readAgentRun(creating.run.id)?.status, 'FAILED');
    assert.equal(readAgentRun(generating.run.id)?.status, 'FAILED');
    assert.equal(readAgentRun(runtimePending.run.id)?.status, 'RUNNING');
  });
});
