import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  PLAN_ARTIFACT_JSON_PATH,
  PLAN_ARTIFACT_MARKDOWN_PATH,
  buildPlanArtifactRequest,
  parsePlanArtifact,
  parsePlanArtifactContent,
  readPlanArtifactFromDirectory,
  renderPlanArtifactMarkdown,
  reviewProjectPlan,
  type PlanArtifact,
} from '../src/planning/plan-artifact.js';

const planContent = {
  goal: 'Refine the dashboard information hierarchy without changing product behavior.',
  context: {
    projectType: 'data synchronization dashboard',
    relevantFiles: ['src/App.tsx', 'src/components/TaskList.tsx'],
    currentBehavior: 'The dashboard shows sync status and recent jobs.',
  },
  decisions: [
    {
      decision: 'Keep task health as the primary page emphasis.',
      reason: 'It is the main operational question the user needs answered quickly.',
    },
  ],
  implementation: [
    {
      id: 'step-1',
      title: 'Refine dashboard hierarchy',
      purpose: 'Rebalance the existing dashboard sections without changing data behavior.',
      files: ['src/App.tsx', 'src/components/TaskList.tsx'],
    },
  ],
  validation: ['Verify the primary task state remains visible in the first viewport.'],
  constraints: ['Preserve existing copy and data behavior.'],
  openQuestions: [],
};

function artifact(status: PlanArtifact['status'] = 'DRAFT'): PlanArtifact {
  return {
    version: 1,
    revision: 1,
    status,
    ...planContent,
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
  };
}

async function createGeneratedFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yakable-plan-'));
  const project = path.join(root, 'demo-project');
  await mkdir(path.join(project, 'src', 'components'), { recursive: true });
  await mkdir(path.join(project, '.yakable'), { recursive: true });
  await writeFile(path.join(project, 'package.json'), '{"name":"demo","type":"module"}\n', 'utf8');
  await writeFile(path.join(project, 'index.html'), '<div id="root"></div>\n', 'utf8');
  await writeFile(path.join(project, 'src', 'main.tsx'), 'import "./App";\n', 'utf8');
  await writeFile(path.join(project, 'src', 'App.tsx'), 'export default function App() { return null; }\n', 'utf8');
  await writeFile(path.join(project, 'src', 'components', 'TaskList.tsx'), 'export function TaskList() { return null; }\n', 'utf8');
  return { root, project };
}

test('parses a bounded plan and grounds current relevantFiles in supplied source context', () => {
  const parsed = parsePlanArtifactContent(
    JSON.stringify(planContent),
    ['src/App.tsx', 'src/components/TaskList.tsx'],
  );
  assert.equal(parsed.goal, planContent.goal);
  assert.deepEqual(parsed.context.relevantFiles, [
    'src/App.tsx',
    'src/components/TaskList.tsx',
  ]);

  assert.throws(
    () =>
      parsePlanArtifactContent(
        JSON.stringify({
          ...planContent,
          context: { ...planContent.context, relevantFiles: ['src/Invented.tsx'] },
        }),
        ['src/App.tsx'],
      ),
    /unavailable context/,
  );
});

test('renders a human-readable review document from the machine-readable artifact', () => {
  const markdown = renderPlanArtifactMarkdown(artifact());
  assert.match(markdown, /# Yakable Plan/);
  assert.match(markdown, /Revision 1 · DRAFT/);
  assert.match(markdown, /## Decisions/);
  assert.match(markdown, /Keep task health as the primary page emphasis/);
  assert.match(markdown, /## Validation/);
  assert.match(markdown, /Preserve existing copy and data behavior/);
});

test('builds planning model context with current plan and bounded selected source only', () => {
  const current = artifact('APPROVED');
  const request = buildPlanArtifactRequest({
    projectId: 'demo-project',
    userRequest: 'Plan a smaller dashboard hierarchy change',
    productRequest: 'Build a data sync dashboard',
    designIntent: null,
    currentPlan: current,
    contextSelection: {
      version: 1,
      relevantFiles: ['src/App.tsx'],
      searchQuery: null,
      reason: 'Selected the app shell.',
      source: 'fallback',
    },
    files: [{ path: 'src/App.tsx', content: 'export default function App() {}' }],
  });
  const parsed = JSON.parse(request) as {
    currentPlan: PlanArtifact;
    project: { files: Array<{ path: string }> };
  };
  assert.equal(parsed.currentPlan.status, 'APPROVED');
  assert.deepEqual(parsed.project.files.map((file) => file.path), ['src/App.tsx']);
});

test('approves a draft artifact and writes matching JSON and Markdown metadata', async () => {
  const fixture = await createGeneratedFixture();
  try {
    const jsonPath = path.join(fixture.project, ...PLAN_ARTIFACT_JSON_PATH.split('/'));
    await writeFile(jsonPath, `${JSON.stringify(artifact(), null, 2)}\n`, 'utf8');

    const reviewed = await reviewProjectPlan(
      'demo-project',
      'APPROVE',
      'Ready for Build.',
      { generatedRoot: fixture.root },
    );
    assert.equal(reviewed.plan.status, 'APPROVED');
    assert.equal(reviewed.plan.revision, 1);
    assert.equal(reviewed.plan.reviewNote, 'Ready for Build.');
    assert.ok(reviewed.plan.reviewedAt);

    const storedJson = parsePlanArtifact(await readFile(jsonPath, 'utf8'));
    assert.equal(storedJson.status, 'APPROVED');

    const markdownPath = path.join(
      fixture.project,
      ...PLAN_ARTIFACT_MARKDOWN_PATH.split('/'),
    );
    const storedMarkdown = await readFile(markdownPath, 'utf8');
    assert.match(storedMarkdown, /Revision 1 · APPROVED/);
    assert.match(storedMarkdown, /Ready for Build/);

    const persistedRead = await readPlanArtifactFromDirectory(fixture.project);
    assert.equal(persistedRead?.status, 'APPROVED');
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});


test('an already reviewed artifact cannot be reviewed again', async () => {
  const fixture = await createGeneratedFixture();
  try {
    const jsonPath = path.join(fixture.project, ...PLAN_ARTIFACT_JSON_PATH.split('/'));
    await writeFile(jsonPath, `${JSON.stringify(artifact('REJECTED'), null, 2)}\n`, 'utf8');
    await assert.rejects(
      reviewProjectPlan('demo-project', 'APPROVE', undefined, {
        generatedRoot: fixture.root,
      }),
      /Only a DRAFT Plan Artifact can be reviewed/,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
