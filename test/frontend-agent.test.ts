import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createFrontendAgentRecorder,
  runFrontendAgentStage,
} from '../src/editing/frontend-agent.js';

test('records the bounded frontend agent happy path', async () => {
  const received: string[] = [];
  const recorder = createFrontendAgentRecorder({
    onEvent(event) {
      received.push(`${event.state}:${event.status}`);
    },
  });

  await runFrontendAgentStage(
    recorder,
    'SELECT_CONTEXT',
    'selecting',
    'selected',
    async () => 'context',
  );
  await runFrontendAgentStage(recorder, 'READ', 'reading', 'read', async () => 'files');
  await runFrontendAgentStage(recorder, 'EDIT', 'editing', 'edited', async () => 'patch');
  recorder.emit('CHECK', 'ACTIVE', 'checking');
  recorder.emit('CHECK', 'COMPLETED', 'healthy');
  recorder.emit('OBSERVE', 'ACTIVE', 'observing', 0);
  recorder.emit('OBSERVE', 'COMPLETED', 'observed', 0);
  recorder.emit('CRITIQUE', 'ACTIVE', 'critiquing', 0);
  recorder.emit('CRITIQUE', 'COMPLETED', 'issues found', 0);
  recorder.emit('REPAIR', 'ACTIVE', 'repairing');
  recorder.emit('REPAIR', 'COMPLETED', 'repaired');
  recorder.emit('OBSERVE', 'ACTIVE', 're-observing', 1);
  recorder.emit('OBSERVE', 'COMPLETED', 're-observed', 1);
  recorder.emit('CRITIQUE', 'ACTIVE', 'final critique', 1);
  recorder.emit('CRITIQUE', 'COMPLETED', 'final critique complete', 1);
  recorder.emit('DONE', 'COMPLETED', 'done');

  assert.deepEqual(received.slice(0, 8), [
    'SELECT_CONTEXT:ACTIVE',
    'SELECT_CONTEXT:COMPLETED',
    'READ:ACTIVE',
    'READ:COMPLETED',
    'EDIT:ACTIVE',
    'EDIT:COMPLETED',
    'CHECK:ACTIVE',
    'CHECK:COMPLETED',
  ]);
  assert.equal(recorder.snapshot().at(-1)?.state, 'DONE');
  assert.equal(recorder.snapshot().filter((event) => event.state === 'REPAIR').length, 2);
});

test('allows critique to finish directly without visual repair', () => {
  const recorder = createFrontendAgentRecorder();
  recorder.emit('SELECT_CONTEXT', 'COMPLETED', 'selected');
  recorder.emit('READ', 'COMPLETED', 'read');
  recorder.emit('EDIT', 'COMPLETED', 'edited');
  recorder.emit('CHECK', 'COMPLETED', 'healthy');
  recorder.emit('OBSERVE', 'COMPLETED', 'observed', 0);
  recorder.emit('CRITIQUE', 'COMPLETED', 'passed', 0);
  recorder.emit('DONE', 'COMPLETED', 'done');

  assert.deepEqual(
    recorder.snapshot().map((event) => event.state),
    ['SELECT_CONTEXT', 'READ', 'EDIT', 'CHECK', 'OBSERVE', 'CRITIQUE', 'DONE'],
  );
});

test('rejects invalid order and a second visual repair cycle', () => {
  const wrongOrder = createFrontendAgentRecorder();
  assert.throws(
    () => wrongOrder.emit('EDIT', 'ACTIVE', 'editing too early'),
    /must start at SELECT_CONTEXT/,
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
    /at most one Visual Repair state/,
  );
});

test('marks a stage failed and preserves the error', async () => {
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
  assert.equal(failure?.state, 'SELECT_CONTEXT');
  assert.equal(failure?.status, 'FAILED');
  assert.match(failure?.message ?? '', /selection failed/);
});
