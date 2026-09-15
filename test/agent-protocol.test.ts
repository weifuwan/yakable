import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAgentProtocolRecorder,
} from '../src/protocol/agent-recorder.js';
import { parseAgentProtocolItem } from '../src/protocol/agent-protocol.js';

test('updates active progress and tool calls in place while preserving item order', () => {
  const published: Array<{ id: string; type: string; status: string }> = [];
  let nextId = 0;
  const recorder = createAgentProtocolRecorder({
    idFactory: () => `item-${++nextId}`,
    now: (() => {
      let tick = 0;
      return () => new Date(`2026-09-15T02:00:0${tick++}.000Z`);
    })(),
    onItem(item) {
      published.push({ id: item.id, type: item.type, status: item.status });
    },
  });

  const progress = recorder.progress('SELECT_CONTEXT', 'ACTIVE', 'Selecting context');
  recorder.progress('SELECT_CONTEXT', 'COMPLETED', 'Selected context');
  const tool = recorder.startToolCall('check_project', 'Checking project');
  recorder.completeToolCall(tool.id, 'COMPLETED', 'Project check passed', '2 commands');

  const snapshot = recorder.snapshot();
  assert.equal(snapshot.length, 2);
  assert.equal(snapshot[0]?.id, progress.id);
  assert.equal(snapshot[0]?.status, 'COMPLETED');
  assert.equal(snapshot[1]?.id, tool.id);
  assert.equal(snapshot[1]?.status, 'COMPLETED');
  assert.deepEqual(
    published.map((item) => [item.id, item.status]),
    [
      [progress.id, 'ACTIVE'],
      [progress.id, 'COMPLETED'],
      [tool.id, 'ACTIVE'],
      [tool.id, 'COMPLETED'],
    ],
  );
});

test('records heterogeneous file, command, check, and message items', () => {
  let nextId = 0;
  const recorder = createAgentProtocolRecorder({ idFactory: () => `item-${++nextId}` });
  recorder.progress('SELECT_CONTEXT', 'COMPLETED', 'Selected context');
  recorder.progress('READ', 'COMPLETED', 'Read files');
  recorder.progress('EDIT', 'COMPLETED', 'Edited source');
  recorder.fileChange({
    changeSetId: 'change-set-1',
    summary: 'Update hero',
    files: [
      { path: 'src/App.tsx', changeType: 'MODIFIED' },
      { path: 'src/Hero.tsx', changeType: 'ADDED' },
    ],
  });
  recorder.progress('CHECK', 'ACTIVE', 'Checking project');
  recorder.commandExecution({
    command: 'tsc --noEmit -p tsconfig.json',
    phase: 'typecheck',
    status: 'COMPLETED',
    message: 'typecheck pass',
    exitCode: 0,
  });
  recorder.checkResult({
    result: 'PASS',
    checks: [
      {
        phase: 'typecheck',
        status: 'PASS',
        exitCode: 0,
        timedOut: false,
        outputTruncated: false,
      },
    ],
    diagnosticCount: 0,
    message: 'Project health checks passed',
  });
  recorder.progress('CHECK', 'COMPLETED', 'Healthy');
  recorder.message('Updated the Hero hierarchy.');

  assert.deepEqual(
    recorder.snapshot().map((item) => item.type),
    [
      'progress',
      'progress',
      'progress',
      'file_change',
      'progress',
      'command_execution',
      'check_result',
      'agent_message',
    ],
  );
});

test('parses a valid structured item and rejects malformed protocol payloads', () => {
  const parsed = parseAgentProtocolItem({
    version: 1,
    id: 'message-1',
    type: 'agent_message',
    status: 'COMPLETED',
    startedAt: '2026-09-15T02:00:00.000Z',
    completedAt: '2026-09-15T02:00:01.000Z',
    message: 'Done',
    role: 'assistant',
    content: 'Done',
  });
  assert.equal(parsed.type, 'agent_message');

  assert.throws(
    () => parseAgentProtocolItem({ version: 1, type: 'progress' }),
    /id is required/,
  );
  assert.throws(
    () => parseAgentProtocolItem({
      version: 1,
      id: 'bad',
      type: 'progress',
      status: 'COMPLETED',
      startedAt: 'now',
      message: 'bad',
      state: 'UNKNOWN',
    }),
    /invalid state/,
  );
});
