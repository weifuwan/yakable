import assert from 'node:assert/strict';
import test from 'node:test';

import { createFrontendAgentEvent } from '../src/editing/frontend-agent.js';
import {
  appendAgentRunEvent,
  completeAgentRun,
  createAgentRun,
  deleteProjectAgentRuns,
  listProjectAgentRuns,
  readAgentRun,
} from '../src/storage/agent-run.js';
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

test('persists an edit agent run and ordered events', () => {
  withMemoryDatabase(() => {
    const run = createAgentRun({
      projectId: 'demo-project',
      kind: 'EDIT',
      prompt: 'Make the hero more concise',
      startedAt: '2026-09-14T10:00:00.000Z',
    });

    appendAgentRunEvent(
      run.id,
      createFrontendAgentEvent(
        'SELECT_CONTEXT',
        'ACTIVE',
        'Selecting focused context',
      ),
    );
    appendAgentRunEvent(
      run.id,
      createFrontendAgentEvent(
        'SELECT_CONTEXT',
        'COMPLETED',
        'Selected focused context',
      ),
    );
    appendAgentRunEvent(
      run.id,
      createFrontendAgentEvent('READ', 'COMPLETED', 'Read 2 files'),
    );

    completeAgentRun(run.id, {
      model: 'deepseek-chat',
      summary: 'Updated hero copy',
      completedAt: '2026-09-14T10:00:03.000Z',
    });

    const stored = readAgentRun(run.id);
    assert.ok(stored);
    assert.equal(stored.projectId, 'demo-project');
    assert.equal(stored.kind, 'EDIT');
    assert.equal(stored.status, 'COMPLETED');
    assert.equal(stored.model, 'deepseek-chat');
    assert.equal(stored.summary, 'Updated hero copy');
    assert.equal(stored.completedAt, '2026-09-14T10:00:03.000Z');
    assert.equal(stored.turnDiff, null);
    assert.deepEqual(stored.changes, []);
    assert.deepEqual(
      stored.events.map((event) => [event.sequence, event.state, event.status]),
      [
        [1, 'SELECT_CONTEXT', 'ACTIVE'],
        [2, 'SELECT_CONTEXT', 'COMPLETED'],
        [3, 'READ', 'COMPLETED'],
      ],
    );

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
    assert.equal(stored.turnDiff.removedLines, 1);
    assert.deepEqual(
      stored.changes.map((change) => ({
        ordinal: change.ordinal,
        path: change.path,
        type: change.type,
      })),
      [
        { ordinal: 1, path: 'src/App.tsx', type: 'MODIFIED' },
        { ordinal: 2, path: 'src/components/Hero.tsx', type: 'ADDED' },
      ],
    );
  });
});

test('a failed agent event marks the run failed and completion keeps that outcome', () => {
  withMemoryDatabase(() => {
    const run = createAgentRun({
      projectId: 'failed-project',
      kind: 'EDIT',
      prompt: 'Break something',
    });

    appendAgentRunEvent(
      run.id,
      createFrontendAgentEvent(
        'SELECT_CONTEXT',
        'FAILED',
        'Could not select project context',
      ),
    );
    completeAgentRun(run.id, {
      model: 'deepseek-chat',
      summary: 'Edit did not complete',
    });

    const stored = readAgentRun(run.id);
    assert.ok(stored);
    assert.equal(stored.status, 'FAILED');
    assert.equal(stored.model, 'deepseek-chat');
    assert.equal(stored.summary, 'Edit did not complete');
    assert.ok(stored.completedAt);
  });
});

test('deletes persisted turn diffs with project agent runs', () => {
  withMemoryDatabase(() => {
    const deletedRun = createAgentRun({ projectId: 'delete-me', kind: 'EDIT', prompt: 'one' });
    recordAgentRunTurnDiff(deletedRun.id, {
      files: [
        {
          path: 'src/App.tsx',
          type: 'MODIFIED',
          beforeContent: 'old',
          afterContent: 'new',
        },
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
