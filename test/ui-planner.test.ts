import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildUiPlannerRequest,
  parseUiPlanValue,
  parseUiPlannerResult,
  planInterface,
  type UiPlan,
} from '../src/planning/ui-planner.js';
import {
  parsePlanArtifact,
  renderPlanArtifactMarkdown,
  type PlanArtifact,
} from '../src/planning/plan-artifact.js';

const uiPlan: UiPlan = {
  version: 1,
  scope: 'PAGE',
  pageType: 'data synchronization dashboard',
  shell: {
    navigation: 'SIDEBAR',
    density: 'COMPACT',
    contentWidth: 'FLUID',
  },
  hierarchy: {
    primary: 'Sync task health and failures',
    secondary: ['Recent task activity', 'Connection availability'],
  },
  sections: [
    {
      id: 'overview',
      title: 'Overview',
      purpose: 'Let operators understand current synchronization health at a glance.',
      priority: 'PRIMARY',
      pattern: 'STATS',
      content: ['Running tasks', 'Failed tasks', 'Rows transferred'],
    },
    {
      id: 'recent-tasks',
      title: 'Recent tasks',
      purpose: 'Show the latest synchronization work and status.',
      priority: 'PRIMARY',
      pattern: 'TABLE',
      content: ['Task name', 'Source and destination', 'Status', 'Duration'],
    },
  ],
  responsive: [
    'Collapse the sidebar on narrow screens.',
    'Stack summary metrics before the task table on small screens.',
  ],
  deliberateOmissions: [
    'Do not add decorative charts that duplicate task-state information.',
  ],
};

const plannerInput = {
  projectId: 'demo-project',
  userRequest: 'Make the dashboard hierarchy clearer',
  productRequest: 'Build a data synchronization dashboard',
  designIntent: null,
  currentUiPlan: uiPlan,
  contextSelection: {
    version: 1 as const,
    relevantFiles: ['src/App.tsx'],
    searchQuery: null,
    reason: 'Selected current page shell.',
    source: 'fallback' as const,
  },
  files: [{ path: 'src/App.tsx', content: 'export default function App() {}' }],
};

test('parses one bounded applicable UI blueprint', () => {
  const result = parseUiPlannerResult(JSON.stringify({
    version: 1,
    status: 'PLANNED',
    reason: 'The request changes dashboard hierarchy and composition.',
    plan: uiPlan,
  }));

  assert.equal(result.status, 'PLANNED');
  if (result.status !== 'PLANNED') throw new Error('Expected PLANNED result.');
  assert.equal(result.plan.shell.navigation, 'SIDEBAR');
  assert.equal(result.plan.sections[1]?.pattern, 'TABLE');
  assert.equal(result.plan.hierarchy.primary, 'Sync task health and failures');
});

test('supports explicit NOT_APPLICABLE without inventing a UI plan', () => {
  const result = parseUiPlannerResult(JSON.stringify({
    version: 1,
    status: 'NOT_APPLICABLE',
    reason: 'The request only changes a non-visual validation note.',
  }));
  assert.deepEqual(result, {
    version: 1,
    status: 'NOT_APPLICABLE',
    reason: 'The request only changes a non-visual validation note.',
  });

  assert.throws(
    () => parseUiPlannerResult(JSON.stringify({
      version: 1,
      status: 'NOT_APPLICABLE',
      reason: 'No UI change.',
      plan: uiPlan,
    })),
    /cannot contain a plan/,
  );
});

test('rejects unbounded or unsupported UI-plan structure', () => {
  assert.throws(
    () => parseUiPlanValue({
      ...uiPlan,
      shell: { ...uiPlan.shell, navigation: 'FLOATING_ORBIT' },
    }),
    /shell.navigation has an invalid value/,
  );

  assert.throws(
    () => parseUiPlanValue({
      ...uiPlan,
      sections: Array.from({ length: 11 }, (_value, index) => ({
        id: `section-${index}`,
        title: `Section ${index}`,
        purpose: 'Purpose',
        priority: 'SECONDARY',
        pattern: 'CUSTOM',
        content: [],
      })),
    }),
    /sections must contain 1-10 items/,
  );
});

test('builds UI Planner context from intent, prior UI plan, and bounded source files', () => {
  const request = buildUiPlannerRequest(plannerInput);

  const parsed = JSON.parse(request) as {
    currentUiPlan: UiPlan;
    project: { files: Array<{ path: string }> };
  };
  assert.equal(parsed.currentUiPlan.sections[0]?.id, 'overview');
  assert.deepEqual(parsed.project.files.map((file) => file.path), ['src/App.tsx']);
});

test('UI Planner is structurally PLAN-only and rejects BUILD before model work', async () => {
  await assert.rejects(
    planInterface({ ...plannerInput, mode: 'BUILD' }),
    /BUILD mode does not allow plan-ui/,
  );
});

test('Plan Artifact persists and renders the UI blueprint as one reviewable contract', () => {
  const artifact: PlanArtifact = {
    version: 1,
    revision: 2,
    status: 'DRAFT',
    goal: 'Refine dashboard hierarchy.',
    context: {
      projectType: 'data synchronization dashboard',
      relevantFiles: ['src/App.tsx'],
    },
    decisions: [],
    ui: uiPlan,
    implementation: [],
    validation: [],
    constraints: [],
    openQuestions: [],
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T11:00:00.000Z',
  };

  const parsed = parsePlanArtifact(JSON.stringify(artifact));
  assert.equal(parsed.ui?.sections[0]?.pattern, 'STATS');

  const markdown = renderPlanArtifactMarkdown(parsed);
  assert.match(markdown, /## UI Blueprint/);
  assert.match(markdown, /Primary hierarchy: Sync task health and failures/);
  assert.match(markdown, /Recent tasks/);
  assert.match(markdown, /Deliberate omissions/);
});
