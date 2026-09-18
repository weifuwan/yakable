import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAgentRun,
  deleteProjectAgentRuns,
} from '../src/storage/agent-run.js';
import {
  deleteAgentRunState,
  readAgentRunState,
  writeAgentRunState,
} from '../src/storage/agent-run-state.js';
import { closeYakableDatabases } from '../src/storage/database.js';

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

test('persists and replaces one continuation state per Agent Run', () => {
  withMemoryDatabase(() => {
    const run = createAgentRun({
      projectId: 'demo-project',
      kind: 'EDIT',
      prompt: 'Polish the Hero',
    });

    writeAgentRunState(run.id, {
      version: 1,
      iteration: 0,
      pendingToolCallId: 'observe-1',
    });
    assert.deepEqual(readAgentRunState(run.id), {
      version: 1,
      iteration: 0,
      pendingToolCallId: 'observe-1',
    });

    writeAgentRunState(run.id, {
      version: 1,
      iteration: 1,
      pendingToolCallId: 'observe-2',
    });
    assert.deepEqual(readAgentRunState(run.id), {
      version: 1,
      iteration: 1,
      pendingToolCallId: 'observe-2',
    });

    deleteAgentRunState(run.id);
    assert.equal(readAgentRunState(run.id), null);
  });
});

test('continuation state is deleted with its Agent Run', () => {
  withMemoryDatabase(() => {
    const run = createAgentRun({
      projectId: 'delete-project',
      kind: 'EDIT',
      prompt: 'Edit the page',
    });
    writeAgentRunState(run.id, {
      version: 1,
      iteration: 0,
      pendingToolCallId: 'observe-1',
    });

    deleteProjectAgentRuns('delete-project');
    assert.equal(readAgentRunState(run.id), null);
  });
});
