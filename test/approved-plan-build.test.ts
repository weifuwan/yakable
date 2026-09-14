import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ApprovedPlanExecutionError,
  buildApprovedPlanExecutionRequest,
  collectApprovedPlanContextHints,
  compileApprovedPlanExecutionContract,
} from '../src/planning/approved-plan-contract.js';
import {
  buildApprovedPlanEditContext,
  buildProjectFromApprovedPlan,
  mergeApprovedPlanContextSelection,
  parseApprovedPlanPatch,
} from '../src/planning/approved-plan-build.js';
import type { PlanArtifact } from '../src/planning/plan-artifact.js';
import { PROJECT_EDIT_SYSTEM_PROMPT } from '../src/editing/edit-prompt.js';
import { PROJECT_REPAIR_SYSTEM_PROMPT } from '../src/editing/repair-prompt.js';

function approvedPlan(overrides: Partial<PlanArtifact> = {}): PlanArtifact {
  return {
    version: 1,
    revision: 3,
    status: 'APPROVED',
    goal: 'Make task health the primary dashboard focus.',
    context: {
      projectType: 'data synchronization dashboard',
      relevantFiles: ['src/App.tsx', 'src/pages/Dashboard.tsx'],
      currentBehavior: 'The dashboard shows task state and connection summaries.',
    },
    decisions: [
      {
        decision: 'Keep failed and running task health as the first visual priority.',
        reason: 'Operators need to understand operational state before secondary detail.',
      },
    ],
    ui: {
      version: 1,
      scope: 'PAGE',
      pageType: 'data synchronization dashboard',
      shell: {
        navigation: 'SIDEBAR',
        density: 'COMPACT',
        contentWidth: 'FLUID',
      },
      hierarchy: {
        primary: 'Task health',
        secondary: ['Recent tasks', 'Connections'],
      },
      sections: [
        {
          id: 'overview',
          title: 'Overview',
          purpose: 'Show task health immediately.',
          priority: 'PRIMARY',
          pattern: 'STATS',
          content: ['Running', 'Failed'],
        },
        {
          id: 'recent-tasks',
          title: 'Recent tasks',
          purpose: 'Show the latest synchronization work.',
          priority: 'PRIMARY',
          pattern: 'TABLE',
          content: ['Task', 'Status', 'Duration'],
        },
      ],
      responsive: ['Collapse the sidebar on narrow screens.'],
      deliberateOmissions: ['Do not add decorative charts that duplicate task health.'],
    },
    implementation: [
      {
        id: 'step-1',
        title: 'Refine dashboard hierarchy',
        purpose: 'Reorder and rebalance the current dashboard surface.',
        files: ['src/pages/Dashboard.tsx', 'src/components/MissingFuture.tsx'],
      },
    ],
    validation: ['Task health remains visible in the first viewport.'],
    constraints: ['Preserve current data behavior and copy.'],
    openQuestions: [],
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T11:00:00.000Z',
    reviewedAt: '2026-09-14T11:01:00.000Z',
    reviewNote: 'Ready for Build.',
    ...overrides,
  };
}

async function createGeneratedFixture(plan?: PlanArtifact) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yakable-approved-plan-'));
  const project = path.join(root, 'demo-project');
  await mkdir(path.join(project, 'src', 'pages'), { recursive: true });
  await mkdir(path.join(project, '.yakable'), { recursive: true });
  await writeFile(path.join(project, 'package.json'), '{"name":"demo","type":"module"}\n', 'utf8');
  await writeFile(path.join(project, 'index.html'), '<div id="root"></div>\n', 'utf8');
  await writeFile(path.join(project, 'src', 'main.tsx'), 'import "./App";\n', 'utf8');
  await writeFile(path.join(project, 'src', 'App.tsx'), 'export default function App() { return null; }\n', 'utf8');
  await writeFile(path.join(project, 'src', 'pages', 'Dashboard.tsx'), 'export function Dashboard() { return null; }\n', 'utf8');
  if (plan) {
    await writeFile(
      path.join(project, '.yakable', 'plan.json'),
      `${JSON.stringify(plan, null, 2)}\n`,
      'utf8',
    );
  }
  return { root, project };
}

test('compiles one immutable execution contract only from a reviewed APPROVED plan', () => {
  const contract = compileApprovedPlanExecutionContract(approvedPlan());
  assert.equal(contract.version, 1);
  assert.equal(contract.source.revision, 3);
  assert.equal(contract.source.approvedAt, '2026-09-14T11:01:00.000Z');
  assert.equal(contract.source.fingerprint.length, 24);
  assert.equal(contract.ui?.hierarchy.primary, 'Task health');
  assert.deepEqual(contract.constraints, ['Preserve current data behavior and copy.']);

  assert.throws(
    () => compileApprovedPlanExecutionContract(approvedPlan({ status: 'DRAFT', reviewedAt: undefined })),
    /requires an APPROVED Plan Artifact/,
  );
});

test('blocks Build when approved plan still contains material open questions', () => {
  assert.throws(
    () => compileApprovedPlanExecutionContract(approvedPlan({ openQuestions: ['Should task failures be grouped by source?'] })),
    (error: unknown) => {
      assert.ok(error instanceof ApprovedPlanExecutionError);
      assert.equal(error.code, 'APPROVED_PLAN_OPEN_QUESTIONS');
      assert.deepEqual(error.deviations, ['Should task failures be grouped by source?']);
      return true;
    },
  );
});

test('approved plan context hints use only current available project files', () => {
  const contract = compileApprovedPlanExecutionContract(approvedPlan());
  assert.deepEqual(
    collectApprovedPlanContextHints(contract, [
      'src/App.tsx',
      'src/pages/Dashboard.tsx',
      'src/Other.tsx',
    ]),
    ['src/App.tsx', 'src/pages/Dashboard.tsx'],
  );

  const merged = mergeApprovedPlanContextSelection(
    {
      version: 1,
      relevantFiles: ['src/Other.tsx'],
      searchQuery: null,
      reason: 'Selected related source.',
      source: 'model',
    },
    contract,
    ['src/App.tsx', 'src/pages/Dashboard.tsx', 'src/Other.tsx'],
  );
  assert.deepEqual(merged.relevantFiles, [
    'src/App.tsx',
    'src/pages/Dashboard.tsx',
    'src/Other.tsx',
  ]);
});

test('approved plan edit context contains the reviewed execution contract separately from edit intent', () => {
  const contract = compileApprovedPlanExecutionContract(approvedPlan());
  const request = buildApprovedPlanExecutionRequest(contract);
  const context = buildApprovedPlanEditContext(
    {
      id: 'demo-project',
      directory: '/tmp/demo-project',
      files: [{ path: 'src/App.tsx', content: 'export default function App() {}' }],
    },
    request,
    null,
    {
      version: 1,
      summary: 'Execute approved plan',
      scope: 'page',
      targetHints: [],
      directives: [],
      preserve: [],
    },
    contract,
  );
  const parsed = JSON.parse(context) as {
    approvedPlan: typeof contract;
    editIntent: { summary: string };
  };
  assert.equal(parsed.approvedPlan.source.revision, 3);
  assert.equal(parsed.approvedPlan.ui?.sections[0]?.id, 'overview');
  assert.equal(parsed.editIntent.summary, 'Execute approved plan');
});

test('approved plan patch can surface BLOCKED without source changes', () => {
  const blocked = parseApprovedPlanPatch(JSON.stringify({
    status: 'BLOCKED',
    summary: 'Cannot honor the reviewed implementation inside the supplied source boundary.',
    deviations: ['A required existing file was not available in the approved execution context.'],
    changes: [],
  }));
  assert.equal(blocked.status, 'BLOCKED');
  assert.equal(blocked.deviations.length, 1);

  const applied = parseApprovedPlanPatch(JSON.stringify({
    status: 'APPLIED',
    summary: 'Applied the approved dashboard hierarchy.',
    deviations: [],
    changes: [{ path: 'src/App.tsx', content: 'export default function App() { return <main />; }' }],
  }));
  assert.equal(applied.status, 'APPLIED');
  if (applied.status !== 'APPLIED') throw new Error('Expected APPLIED patch.');
  assert.equal(applied.patch.changes[0]?.path, 'src/App.tsx');
});

test('Build refuses a DRAFT persisted plan before invoking source generation', async () => {
  const fixture = await createGeneratedFixture(
    approvedPlan({ status: 'DRAFT', reviewedAt: undefined, reviewNote: undefined }),
  );
  try {
    await assert.rejects(
      buildProjectFromApprovedPlan('demo-project', { generatedRoot: fixture.root }),
      /requires an APPROVED Plan Artifact/,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('edit and repair prompts make approved plan execution non-replanning', () => {
  assert.match(PROJECT_EDIT_SYSTEM_PROMPT, /approvedPlan as the execution contract/);
  assert.match(PROJECT_EDIT_SYSTEM_PROMPT, /do not silently compromise/i);
  assert.match(PROJECT_EDIT_SYSTEM_PROMPT, /"status": "BLOCKED"/);
  assert.match(PROJECT_REPAIR_SYSTEM_PROMPT, /Repair the implementation, not the plan/);
});
