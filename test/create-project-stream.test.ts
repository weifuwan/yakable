import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeCreationAgentItem } from '../dashboard/src/create-project.js';
import type { ProjectCreationStatus } from '../dashboard/src/create-project.js';
import type { AgentProtocolItem } from '../src/protocol/agent-protocol.js';

const createdAt = '2026-09-15T05:00:00.000Z';

function status(): ProjectCreationStatus {
  return {
    project: {
      id: 'demo-project',
      name: 'Demo Project',
      prompt: 'Build a demo',
      status: 'GENERATING',
      activeRunId: 'run-1',
      createdAt,
      updatedAt: createdAt,
    },
    run: {
      id: 'run-1',
      status: 'RUNNING',
      startedAt: createdAt,
      items: [],
    },
  };
}

function progress(
  id: string,
  state: 'GENERATE' | 'DONE',
  itemStatus: 'ACTIVE' | 'COMPLETED' | 'FAILED',
): AgentProtocolItem {
  return {
    version: 1,
    id,
    type: 'progress',
    state,
    status: itemStatus,
    startedAt: createdAt,
    ...(itemStatus === 'ACTIVE' ? {} : { completedAt: '2026-09-15T05:00:02.000Z' }),
    message: `${state} ${itemStatus}`,
  };
}

test('live create items update in place by protocol item id', () => {
  const active = progress('progress:GENERATE:0', 'GENERATE', 'ACTIVE');
  const completed = progress('progress:GENERATE:0', 'GENERATE', 'COMPLETED');

  const first = mergeCreationAgentItem(status(), 'run-1', active);
  const next = mergeCreationAgentItem(first, 'run-1', completed);

  assert.equal(next.run?.items?.length, 1);
  assert.equal(next.run?.items?.[0]?.status, 'COMPLETED');
});

test('DONE live item closes the projected run immediately', () => {
  const done = progress('progress:DONE:0', 'DONE', 'COMPLETED');
  const next = mergeCreationAgentItem(status(), 'run-1', done);

  assert.equal(next.run?.status, 'COMPLETED');
  assert.equal(next.run?.completedAt, '2026-09-15T05:00:02.000Z');
});

test('items from another run do not mutate the current creation state', () => {
  const current = status();
  const next = mergeCreationAgentItem(
    current,
    'another-run',
    progress('progress:GENERATE:0', 'GENERATE', 'ACTIVE'),
  );
  assert.equal(next, current);
});
