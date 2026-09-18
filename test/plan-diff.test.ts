import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  diffPlanArtifacts,
  renderPlanDiffMarkdown,
} from '../src/planning/plan-diff.js';
import type { PlanArtifact } from '../src/planning/plan-artifact.js';
import {
  readProjectPlanDiff,
  readProjectPlanRevision,
} from '../src/planning/replan.js';

function plan(revision: number, overrides: Partial<PlanArtifact> = {}): PlanArtifact {
  return {
    version: 1,
    revision,
    status: revision === 1 ? 'APPROVED' : 'DRAFT',
    goal: 'Keep task health as the primary dashboard focus.',
    context: {
      projectType: 'data synchronization dashboard',
      relevantFiles: ['src/App.tsx'],
      currentBehavior: 'The dashboard shows sync status and recent tasks.',
    },
    decisions: [
      {
        decision: 'Keep task health primary.',
        reason: 'Operators need failures and running state first.',
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
        primary: 'Sync task health',
        secondary: ['Recent tasks'],
      },
      sections: [
        {
          id: 'overview',
          title: 'Overview',
          purpose: 'Show task health.',
          priority: 'PRIMARY',
          pattern: 'STATS',
          content: ['Running', 'Failed'],
        },
      ],
      responsive: ['Collapse the sidebar on narrow screens.'],
      deliberateOmissions: ['Do not add decorative charts.'],
    },
    implementation: [
      {
        id: 'step-1',
        title: 'Refine overview',
        purpose: 'Make health status dominant.',
        files: ['src/App.tsx'],
      },
    ],
    validation: ['Health status stays visible in the first viewport.'],
    constraints: ['Preserve current task data behavior.'],
    openQuestions: [],
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: `2026-09-14T10:0${revision}:00.000Z`,
    ...(revision === 1
      ? {
          reviewedAt: '2026-09-14T10:01:00.000Z',
          reviewNote: 'Approved baseline.',
        }
      : {}),
    ...overrides,
  };
}

async function createGeneratedFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yakable-plan-diff-'));
  const project = path.join(root, 'demo-project');
  await mkdir(path.join(project, 'src'), { recursive: true });
  await mkdir(path.join(project, '.yakable'), { recursive: true });
  await writeFile(path.join(project, 'package.json'), '{"name":"demo","type":"module"}\n', 'utf8');
  await writeFile(path.join(project, 'index.html'), '<div id="root"></div>\n', 'utf8');
  await writeFile(path.join(project, 'src', 'main.tsx'), 'import "./App";\n', 'utf8');
  await writeFile(path.join(project, 'src', 'App.tsx'), 'export default function App() { return null; }\n', 'utf8');
  return { root, project };
}

test('Plan Diff reports structural changes instead of treating a re-plan as opaque replacement', () => {
  const previous = plan(1);
  const current = plan(2, {
    goal: 'Make failed synchronization tasks the strongest dashboard signal.',
    decisions: [
      {
        decision: 'Keep task health primary.',
        reason: 'Failures should receive stronger emphasis than running tasks.',
      },
      {
        decision: 'Keep connections secondary.',
        reason: 'Connection management is not the first operational question.',
      },
    ],
    ui: {
      ...previous.ui!,
      shell: { ...previous.ui!.shell, density: 'COMFORTABLE' },
      hierarchy: {
        primary: 'Failed synchronization tasks',
        secondary: ['Running tasks', 'Recent tasks'],
      },
      sections: [
        {
          ...previous.ui!.sections[0]!,
          content: ['Failed', 'Running', 'Rows transferred'],
        },
        {
          id: 'recent-tasks',
          title: 'Recent tasks',
          purpose: 'Show latest synchronization work.',
          priority: 'PRIMARY',
          pattern: 'TABLE',
          content: ['Task', 'Status', 'Duration'],
        },
      ],
    },
    constraints: [
      'Preserve current task data behavior.',
      'Do not add new dependencies.',
    ],
  });

  const diff = diffPlanArtifacts(previous, current);
  assert.equal(diff.status, 'CHANGED');
  assert.equal(diff.fromRevision, 1);
  assert.equal(diff.toRevision, 2);
  assert.ok(diff.summary.added > 0);
  assert.ok(diff.summary.changed > 0);
  assert.ok(diff.entries.some((entry) => entry.path === 'goal' && entry.change === 'CHANGED'));
  assert.ok(diff.entries.some((entry) => entry.path === 'ui.shell.density'));
  assert.ok(diff.entries.some((entry) => entry.path === 'ui.sections:recent-tasks' && entry.change === 'ADDED'));
  assert.ok(diff.entries.some((entry) => entry.path === 'decisions:Keep task health primary.:reason'));

  const markdown = renderPlanDiffMarkdown(diff);
  assert.match(markdown, /r1 → r2 · CHANGED/);
  assert.match(markdown, /ui\.sections:recent-tasks/);
  assert.match(markdown, /Before:/);
  assert.match(markdown, /After:/);
});

test('Plan Diff distinguishes first revision, missing baseline, and unchanged content', () => {
  assert.equal(diffPlanArtifacts(null, plan(1)).status, 'INITIAL');
  assert.equal(diffPlanArtifacts(null, plan(3)).status, 'BASELINE_MISSING');
  assert.equal(diffPlanArtifacts(plan(1), plan(2)).status, 'UNCHANGED');
});

test('archived revisions remain readable after plan.json advances and power latest diff', async () => {
  const fixture = await createGeneratedFixture();
  try {
    const r1 = plan(1);
    const r2 = plan(2, {
      goal: 'Show failed task health before all secondary dashboard information.',
    });
    const historyDirectory = path.join(fixture.project, '.yakable', 'plans');
    await mkdir(historyDirectory, { recursive: true });
    await writeFile(
      path.join(historyDirectory, 'revision-000001.json'),
      `${JSON.stringify(r1, null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      path.join(fixture.project, '.yakable', 'plan.json'),
      `${JSON.stringify(r2, null, 2)}\n`,
      'utf8',
    );

    const archived = await readProjectPlanRevision('demo-project', 1, {
      generatedRoot: fixture.root,
    });
    assert.equal(archived?.revision, 1);
    assert.equal(archived?.status, 'APPROVED');

    const latest = await readProjectPlanDiff('demo-project', {
      generatedRoot: fixture.root,
    });
    assert.equal(latest?.diff.fromRevision, 1);
    assert.equal(latest?.diff.toRevision, 2);
    assert.equal(latest?.diff.status, 'CHANGED');
    assert.match(latest?.markdown ?? '', /Show failed task health/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});


