import assert from 'node:assert/strict';
import test from 'node:test';

import { readAgentRun } from '../src/storage/agent-run.js';
import { closeYakableDatabases } from '../src/storage/database.js';
import {
  beginProjectBuildLifecycle,
  deleteProjectLifecycle,
  failProjectLifecycle,
  readProjectLifecycle,
  transitionProjectLifecycle,
} from '../src/storage/project-lifecycle.js';

function withMemoryDatabase(run: () => void): void {
  const previous = process.env.YAKABLE_DB_PATH;
  closeYakableDatabases();
  process.env.YAKABLE_DB_PATH = ':memory:';
  try {
    run();
  } finally {
    closeYakableDatabases();
    if (previous === undefined) delete process.env.YAKABLE_DB_PATH;
    else process.env.YAKABLE_DB_PATH = previous;
  }
}

test('creates a project lifecycle and CREATE Agent run before generation', () => {
  withMemoryDatabase(() => {
    const lifecycle = beginProjectBuildLifecycle({
      projectId: 'saas-homepage-2026-09-15-test',
      prompt: 'Build a SaaS homepage',
      createdAt: '2026-09-15T03:30:00.000Z',
    });

    assert.equal(lifecycle.project.status, 'CREATING');
    assert.equal(lifecycle.project.activeRunId, lifecycle.run.id);
    assert.equal(lifecycle.run.projectId, lifecycle.project.projectId);
    assert.equal(lifecycle.run.kind, 'CREATE');
    assert.equal(lifecycle.run.status, 'RUNNING');
    assert.equal(readAgentRun(lifecycle.run.id)?.prompt, 'Build a SaaS homepage');
  });
});

test('advances the creation lifecycle independently from the Agent run', () => {
  withMemoryDatabase(() => {
    const { project, run } = beginProjectBuildLifecycle({
      projectId: 'lifecycle-project',
      prompt: 'Build a project',
      createdAt: '2026-09-15T04:00:00.000Z',
    });

    const generating = transitionProjectLifecycle(project.projectId, 'GENERATING', {
      updatedAt: '2026-09-15T04:00:01.000Z',
    });
    const starting = transitionProjectLifecycle(project.projectId, 'STARTING_RUNTIME', {
      updatedAt: '2026-09-15T04:00:02.000Z',
    });
    const ready = transitionProjectLifecycle(project.projectId, 'READY', {
      updatedAt: '2026-09-15T04:00:03.000Z',
    });

    assert.equal(generating.activeRunId, run.id);
    assert.equal(starting.status, 'STARTING_RUNTIME');
    assert.equal(ready.status, 'READY');
    assert.equal(ready.failureMessage, undefined);
    assert.equal(readAgentRun(run.id)?.status, 'RUNNING');
  });
});

test('records terminal project failures and rejects invalid backwards transitions', () => {
  withMemoryDatabase(() => {
    const { project } = beginProjectBuildLifecycle({
      projectId: 'failed-lifecycle-project',
      prompt: 'Build a project that fails',
    });

    transitionProjectLifecycle(project.projectId, 'GENERATING');
    const failed = failProjectLifecycle(project.projectId, new Error('Model request timed out'));

    assert.equal(failed.status, 'FAILED');
    assert.equal(failed.failureMessage, 'Model request timed out');
    assert.throws(
      () => transitionProjectLifecycle(project.projectId, 'GENERATING'),
      /Invalid project lifecycle transition: FAILED -> GENERATING/,
    );
  });
});

test('deletes lifecycle state without deleting the linked Agent run', () => {
  withMemoryDatabase(() => {
    const { project, run } = beginProjectBuildLifecycle({
      projectId: 'delete-lifecycle-project',
      prompt: 'Build and delete lifecycle metadata',
    });

    deleteProjectLifecycle(project.projectId);

    assert.equal(readProjectLifecycle(project.projectId), null);
    assert.ok(readAgentRun(run.id));
  });
});
