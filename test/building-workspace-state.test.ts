import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  AgentFileChangeItem,
  AgentProgressItem,
  AgentProgressState,
} from '../src/protocol/agent-protocol.js';
import {
  buildCreationSteps,
  creationChangedFileCount,
  creationPreviewCopy,
  latestCreationMessage,
} from '../dashboard/src/building-workspace-state.js';
import type { ProjectCreationStatus } from '../dashboard/src/create-project.js';

function progress(
  state: AgentProgressState,
  status: AgentProgressItem['status'],
  message: string,
  index: number,
): AgentProgressItem {
  return {
    version: 1,
    id: `${state.toLowerCase()}-${index}`,
    type: 'progress',
    status,
    state,
    startedAt: `2026-09-15T04:00:0${index}.000Z`,
    ...(status === 'ACTIVE' ? {} : { completedAt: `2026-09-15T04:00:1${index}.000Z` }),
    message,
  };
}

function creation(
  status: ProjectCreationStatus['project']['status'],
  items: NonNullable<ProjectCreationStatus['run']>['items'] = [],
): ProjectCreationStatus {
  return {
    project: {
      id: 'demo-project',
      name: 'Demo Project',
      prompt: 'Build a clean SaaS homepage',
      status,
      activeRunId: 'run-1',
      createdAt: '2026-09-15T04:00:00.000Z',
      updatedAt: '2026-09-15T04:00:01.000Z',
    },
    run: {
      id: 'run-1',
      status: status === 'FAILED' ? 'FAILED' : status === 'READY' ? 'COMPLETED' : 'RUNNING',
      startedAt: '2026-09-15T04:00:00.000Z',
      items,
    },
  };
}

test('shows a useful first active step before Agent items arrive', () => {
  const steps = buildCreationSteps(creation('CREATING'));
  assert.equal(steps[0]?.state, 'UNDERSTAND');
  assert.equal(steps[0]?.status, 'active');
  assert.ok(steps.slice(1).every((step) => step.status === 'pending'));
});

test('projects persisted Agent progress into Lovable-style build steps', () => {
  const state = creation('GENERATING', [
    progress('UNDERSTAND', 'COMPLETED', 'Understood the product request', 1),
    progress('DESIGN', 'COMPLETED', 'Design direction ready', 2),
    progress('TEMPLATE', 'COMPLETED', 'Selected the website template', 3),
    progress('GENERATE', 'ACTIVE', 'Generating the project-owned frontend layer', 4),
  ]);
  const steps = buildCreationSteps(state);

  assert.equal(steps.find((step) => step.state === 'UNDERSTAND')?.status, 'complete');
  assert.equal(steps.find((step) => step.state === 'GENERATE')?.status, 'active');
  assert.equal(steps.find((step) => step.state === 'WRITE')?.status, 'pending');
  assert.equal(latestCreationMessage(state), 'Generating the project-owned frontend layer');
});

test('adds repair only when the create run actually enters repair', () => {
  const state = creation('GENERATING', [
    progress('UNDERSTAND', 'COMPLETED', 'Understood request', 1),
    progress('DESIGN', 'COMPLETED', 'Designed experience', 2),
    progress('TEMPLATE', 'COMPLETED', 'Prepared project', 3),
    progress('GENERATE', 'COMPLETED', 'Generated source', 4),
    progress('WRITE', 'COMPLETED', 'Wrote source', 5),
    progress('CHECK', 'COMPLETED', 'Initial check finished', 6),
    progress('REPAIR', 'ACTIVE', 'Applying one bounded build repair', 7),
  ]);

  const steps = buildCreationSteps(state);
  const repairIndex = steps.findIndex((step) => step.state === 'REPAIR');
  const runtimeIndex = steps.findIndex((step) => step.state === 'RUNTIME');
  assert.ok(repairIndex > -1);
  assert.ok(runtimeIndex > repairIndex);
  assert.equal(steps[repairIndex]?.status, 'active');
});

test('uses lifecycle state as fallback while runtime progress catches up', () => {
  const state = creation('STARTING_RUNTIME', [
    progress('UNDERSTAND', 'COMPLETED', 'Understood request', 1),
    progress('DESIGN', 'COMPLETED', 'Designed experience', 2),
    progress('TEMPLATE', 'COMPLETED', 'Prepared project', 3),
    progress('GENERATE', 'COMPLETED', 'Generated source', 4),
    progress('WRITE', 'COMPLETED', 'Wrote source', 5),
    progress('CHECK', 'COMPLETED', 'Checks passed', 6),
  ]);

  assert.equal(
    buildCreationSteps(state).find((step) => step.state === 'RUNTIME')?.status,
    'active',
  );
  assert.equal(creationPreviewCopy('STARTING_RUNTIME').title, 'Starting your preview');
});

test('counts unique prepared files from structured file-change items', () => {
  const change: AgentFileChangeItem = {
    version: 1,
    id: 'changes-1',
    type: 'file_change',
    status: 'COMPLETED',
    startedAt: '2026-09-15T04:00:05.000Z',
    completedAt: '2026-09-15T04:00:06.000Z',
    message: 'Applied product layer',
    changeSetId: 'set-1',
    summary: 'Applied product layer',
    files: [
      { path: 'src/App.tsx', changeType: 'MODIFIED' },
      { path: 'src/pages/HomePage.tsx', changeType: 'ADDED' },
      { path: 'src/App.tsx', changeType: 'MODIFIED' },
    ],
  };

  assert.equal(creationChangedFileCount(creation('GENERATING', [change])), 2);
  assert.equal(creationPreviewCopy('FAILED', 'Model timed out').detail, 'Model timed out');
});
