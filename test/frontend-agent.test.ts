import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createFrontendAgentRecorder,
  runFrontendAgentStage,
} from '../src/editing/frontend-agent.js';

test('updates one structured progress item from active to completed', async () => {
  const received: Array<{ id: string; state: string; status: string }> = [];
  let nextId = 0;
  const recorder = createFrontendAgentRecorder({
    onEvent(item) {
      if (item.type === 'progress') {
        received.push({ id: item.id, state: item.state, status: item.status });
      }
    },
  });

  await runFrontendAgentStage(
    recorder,
    'SELECT_CONTEXT',
    'selecting',
    'selected',
    async () => 'context',
  );

  assert.equal(received.length, 2);
  assert.equal(received[0]?.state, 'SELECT_CONTEXT');
  assert.equal(received[0]?.status, 'ACTIVE');
  assert.equal(received[1]?.status, 'COMPLETED');
  assert.equal(received[0]?.id, received[1]?.id);

  const snapshot = recorder.snapshot();
  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0]?.type, 'progress');
  if (snapshot[0]?.type === 'progress') {
    assert.equal(snapshot[0].state, 'SELECT_CONTEXT');
    assert.equal(snapshot[0].status, 'COMPLETED');
    assert.ok(snapshot[0].completedAt);
  }
  void nextId;
});

test('records the bounded edit path as progress items', async () => {
  const recorder = createFrontendAgentRecorder();
  await runFrontendAgentStage(recorder, 'SELECT_CONTEXT', 'selecting', 'selected', async () => 'context');
  await runFrontendAgentStage(recorder, 'READ', 'reading', 'read', async () => 'files');
  await runFrontendAgentStage(recorder, 'EDIT', 'editing', 'edited', async () => 'patch');
  recorder.emit('CHECK', 'ACTIVE', 'checking');
  recorder.emit('REPAIR', 'ACTIVE', 'repairing');
  recorder.emit('REPAIR', 'COMPLETED', 'repaired');
  recorder.emit('CHECK', 'COMPLETED', 'healthy');
  recorder.emit('OBSERVE', 'COMPLETED', 'observed', 0);
  recorder.emit('CRITIQUE', 'COMPLETED', 'passed', 0);
  recorder.emit('DONE', 'COMPLETED', 'done');

  const progress = recorder.snapshot().filter((item) => item.type === 'progress');
  assert.deepEqual(
    progress.map((item) => item.state),
    ['SELECT_CONTEXT', 'READ', 'EDIT', 'CHECK', 'REPAIR', 'OBSERVE', 'CRITIQUE', 'DONE'],
  );
  assert.equal(progress.find((item) => item.state === 'REPAIR')?.status, 'COMPLETED');
  assert.equal(progress.find((item) => item.state === 'CHECK')?.status, 'COMPLETED');
});

test('records the create pipeline through runtime after bounded repair', () => {
  const recorder = createFrontendAgentRecorder();
  recorder.emit('ROUTE', 'COMPLETED', 'create');
  recorder.emit('UNDERSTAND', 'COMPLETED', 'understood');
  recorder.emit('DESIGN', 'COMPLETED', 'designed');
  recorder.emit('TEMPLATE', 'COMPLETED', 'template');
  recorder.emit('GENERATE', 'COMPLETED', 'generated');
  recorder.emit('WRITE', 'COMPLETED', 'written');
  recorder.emit('CHECK', 'ACTIVE', 'checking');
  recorder.emit('REPAIR', 'ACTIVE', 'repairing');
  recorder.emit('REPAIR', 'COMPLETED', 'repaired');
  recorder.emit('CHECK', 'COMPLETED', 'healthy');
  recorder.emit('RUNTIME', 'COMPLETED', 'runtime ready');
  recorder.emit('DONE', 'COMPLETED', 'done');

  const progress = recorder.snapshot().filter((item) => item.type === 'progress');
  assert.deepEqual(
    progress.map((item) => item.state),
    ['ROUTE', 'UNDERSTAND', 'DESIGN', 'TEMPLATE', 'GENERATE', 'WRITE', 'CHECK', 'REPAIR', 'RUNTIME', 'DONE'],
  );
});

test('rejects invalid order and a second visual repair cycle', () => {
  const wrongOrder = createFrontendAgentRecorder();
  assert.throws(
    () => wrongOrder.emit('EDIT', 'ACTIVE', 'editing too early'),
    /must start at ROUTE or SELECT_CONTEXT/,
  );

  const recorder = createFrontendAgentRecorder();
  recorder.emit('SELECT_CONTEXT', 'COMPLETED', 'selected');
  recorder.emit('READ', 'COMPLETED', 'read');
  recorder.emit('EDIT', 'COMPLETED', 'edited');
  recorder.emit('CHECK', 'COMPLETED', 'healthy');
  recorder.emit('OBSERVE', 'COMPLETED', 'observed', 0);
  recorder.emit('CRITIQUE', 'COMPLETED', 'failed', 0);
  recorder.emit('REPAIR', 'COMPLETED', 'repaired');
  recorder.emit('OBSERVE', 'COMPLETED', 'observed again', 1);
  recorder.emit('CRITIQUE', 'COMPLETED', 'still failed', 1);

  assert.throws(
    () => recorder.emit('REPAIR', 'ACTIVE', 'second repair'),
    /at most one Repair state/,
  );
});

test('marks a stage failed on the same progress item', async () => {
  const recorder = createFrontendAgentRecorder();
  await assert.rejects(
    () =>
      runFrontendAgentStage(
        recorder,
        'SELECT_CONTEXT',
        'selecting context',
        'selected context',
        async () => {
          throw new Error('selection failed');
        },
      ),
    /selection failed/,
  );

  const failure = recorder.snapshot().at(-1);
  assert.equal(failure?.type, 'progress');
  if (failure?.type === 'progress') assert.equal(failure.state, 'SELECT_CONTEXT');
  assert.equal(failure?.status, 'FAILED');
  assert.match(failure?.message ?? '', /selection failed/);
});
