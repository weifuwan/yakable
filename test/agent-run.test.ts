import assert from 'node:assert/strict';
import test from 'node:test';

import { createAgentProtocolRecorder } from '../src/protocol/agent-recorder.js';
import {
  cancelAgentRun,
  completeAgentRun,
  createAgentRun,
  deleteProjectAgentRuns,
  listProjectAgentRuns,
  readAgentRun,
} from '../src/storage/agent-run.js';
import { upsertAgentRunItem } from '../src/storage/agent-run-item.js';
import { recordAgentRunTurnDiff } from '../src/storage/agent-run-turn-diff.js';
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

test('persists ordered structured items and updates an item in place', () => {
  withMemoryDatabase(() => {
    const run = createAgentRun({
      projectId: 'demo-project',
      kind: 'EDIT',
      prompt: 'Make the hero more concise',
      startedAt: '2026-09-14T10:00:00.000Z',
    });
    let nextId = 0;
    const recorder = createAgentProtocolRecorder({
      idFactory: () => `item-${++nextId}`,
      onItem: (item) => {
        upsertAgentRunItem(run.id, item);
      },
    });

    const selecting = recorder.progress('SELECT_CONTEXT', 'ACTIVE', 'Selecting focused context');
    recorder.progress('SELECT_CONTEXT', 'COMPLETED', 'Selected focused context');
    recorder.progress('READ', 'COMPLETED', 'Read 2 files');
    recorder.fileChange({
      changeSetId: 'changes-1',
      summary: 'Updated hero copy',
      files: [{ path: 'src/App.tsx', changeType: 'MODIFIED' }],
    });

    completeAgentRun(run.id, {
      model: 'deepseek-chat',
      summary: 'Updated hero copy',
      completedAt: '2026-09-14T10:00:03.000Z',
    });

    const stored = readAgentRun(run.id);
    assert.ok(stored);
    assert.equal(stored.projectId, 'demo-project');
    assert.equal(stored.status, 'COMPLETED');
    assert.equal(stored.items.length, 3);
    assert.equal(stored.items[0]?.id, selecting.id);
    assert.equal(stored.items[0]?.status, 'COMPLETED');
    assert.equal(stored.items[1]?.type, 'progress');
    assert.equal(stored.items[2]?.type, 'file_change');
    assert.equal(stored.turnDiff, null);
    assert.deepEqual(stored.changes, []);
    assert.equal(listProjectAgentRuns('demo-project').at(0)?.id, run.id);
  });
});

test('persists one net turn diff and projects the current changes view from it', () => {
  withMemoryDatabase(() => {
    const run = createAgentRun({
      projectId: 'diff-project',
      kind: 'EDIT',
      prompt: 'Polish the hero',
    });

    recordAgentRunTurnDiff(run.id, {
      files: [
        {
          path: 'src/App.tsx',
          type: 'MODIFIED',
          beforeContent: 'export default function App() { return <h1>Old</h1>; }',
          afterContent: 'export default function App() { return <h1>Better</h1>; }',
        },
        {
          path: 'src/components/Hero.tsx',
          type: 'ADDED',
          beforeContent: null,
          afterContent: 'export function Hero() { return <section />; }',
        },
      ],
      unifiedDiff: 'diff --git a/src/App.tsx b/src/App.tsx',
      addedLines: 2,
      removedLines: 1,
    });

    const stored = readAgentRun(run.id);
    assert.ok(stored?.turnDiff);
    assert.equal(stored.turnDiff.addedLines, 2);
    assert.deepEqual(
      stored.changes.map((change) => ({ ordinal: change.ordinal, path: change.path, type: change.type })),
      [
        { ordinal: 1, path: 'src/App.tsx', type: 'MODIFIED' },
        { ordinal: 2, path: 'src/components/Hero.tsx', type: 'ADDED' },
      ],
    );
  });
});

test('only failed progress items make the whole run terminally failed', () => {
  withMemoryDatabase(() => {
    const recoverable = createAgentRun({
      projectId: 'recoverable-project',
      kind: 'EDIT',
      prompt: 'Repair a compile issue',
    });
    let recoverableId = 0;
    const recoverableRecorder = createAgentProtocolRecorder({
      idFactory: () => `recoverable-${++recoverableId}`,
      onItem: (item) => upsertAgentRunItem(recoverable.id, item),
    });
    recoverableRecorder.progress('SELECT_CONTEXT', 'COMPLETED', 'Selected context');
    recoverableRecorder.progress('READ', 'COMPLETED', 'Read context');
    recoverableRecorder.progress('EDIT', 'COMPLETED', 'Applied edit');
    recoverableRecorder.progress('CHECK', 'ACTIVE', 'Checking');
    recoverableRecorder.checkResult({
      result: 'FAIL',
      checks: [],
      diagnosticCount: 1,
      message: 'Initial check failed and can be repaired',
    });
    assert.equal(readAgentRun(recoverable.id)?.status, 'RUNNING');

    const failed = createAgentRun({
      projectId: 'failed-project',
      kind: 'EDIT',
      prompt: 'Break something',
    });
    let failedId = 0;
    const failedRecorder = createAgentProtocolRecorder({
      idFactory: () => `failed-${++failedId}`,
      onItem: (item) => upsertAgentRunItem(failed.id, item),
    });
    failedRecorder.progress('SELECT_CONTEXT', 'FAILED', 'Could not select project context');
    completeAgentRun(failed.id, {
      model: 'deepseek-chat',
      summary: 'Edit did not complete',
    });

    const stored = readAgentRun(failed.id);
    assert.equal(stored?.status, 'FAILED');
    assert.equal(stored?.summary, 'Edit did not complete');
    assert.ok(stored?.completedAt);
  });
});

test('persists a user stop as cancelled and keeps the cancelled metadata terminal', () => {
  withMemoryDatabase(() => {
    const run = createAgentRun({
      projectId: 'cancelled-project',
      kind: 'EDIT',
      prompt: 'Change the hero',
    });
    const recorder = createAgentProtocolRecorder({
      idFactory: () => 'cancelled-progress',
      onItem: (item) => upsertAgentRunItem(run.id, item),
    });

    recorder.progress('SELECT_CONTEXT', 'FAILED', 'Stopped by user.');
    assert.equal(readAgentRun(run.id)?.status, 'CANCELLED');

    cancelAgentRun(run.id, { summary: 'Stopped by user.' });
    completeAgentRun(run.id, { summary: 'This must not turn the run into completed.' });

    const stored = readAgentRun(run.id);
    assert.equal(stored?.status, 'CANCELLED');
    assert.equal(stored?.summary, 'Stopped by user.');
    assert.ok(stored?.completedAt);
  });
});

test('deletes structured items and turn diffs with project agent runs', () => {
  withMemoryDatabase(() => {
    const deletedRun = createAgentRun({ projectId: 'delete-me', kind: 'EDIT', prompt: 'one' });
    const recorder = createAgentProtocolRecorder({
      idFactory: () => 'delete-item',
      onItem: (item) => upsertAgentRunItem(deletedRun.id, item),
    });
    recorder.progress('SELECT_CONTEXT', 'COMPLETED', 'Selected context');
    recordAgentRunTurnDiff(deletedRun.id, {
      files: [
        { path: 'src/App.tsx', type: 'MODIFIED', beforeContent: 'old', afterContent: 'new' },
      ],
      unifiedDiff: 'diff',
      addedLines: 1,
      removedLines: 1,
    });
    createAgentRun({ projectId: 'delete-me', kind: 'EDIT', prompt: 'two' });
    createAgentRun({ projectId: 'keep-me', kind: 'EDIT', prompt: 'three' });

    deleteProjectAgentRuns('delete-me');

    assert.equal(listProjectAgentRuns('delete-me').length, 0);
    assert.equal(listProjectAgentRuns('keep-me').length, 1);
  });
});
