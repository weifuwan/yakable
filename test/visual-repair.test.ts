import assert from 'node:assert/strict';
import test from 'node:test';

import type { DesignCriticResult } from '../src/editing/design-critic.js';
import type { EditIntentDelta } from '../src/editing/edit-intent.js';
import {
  assertVisualRepairPatchUsesContext,
  buildVisualRepairRequest,
  runVisualRepairOnce,
  selectVisualRepairContextFiles,
} from '../src/editing/visual-repair.js';
import type { PageObservation } from '../src/runtime/page-observation.js';
import type { CheckProjectOutput } from '../src/tools/check-project.js';
import type { ToolResult } from '../src/tools/tool.js';
import type { DesignIntentIR, ProjectPatch } from '../src/types.js';

const designIntent: DesignIntentIR = {
  version: 1,
  product: {
    type: 'SaaS',
    surface: 'landing-page',
    primaryGoal: 'Drive signup',
    targetAudience: 'developers',
  },
  designDirection: 'Restrained hierarchy with minimal decoration.',
  styleSignals: ['restrained'],
  requirements: [],
  directives: [],
  antiPatterns: ['heavy decoration'],
  openQuestions: [],
};

const editIntent: EditIntentDelta = {
  version: 1,
  summary: 'Refine the Hero hierarchy without changing copy.',
  scope: 'section',
  targetHints: ['Hero'],
  directives: [
    {
      area: 'visual-hierarchy',
      directive: 'Strengthen the primary heading and CTA hierarchy.',
      basis: 'interpreted',
    },
  ],
  preserve: ['existing copy'],
};

const observation: PageObservation = {
  version: 1,
  route: '/',
  viewport: {
    width: 1440,
    height: 900,
    scrollX: 0,
    scrollY: 0,
    devicePixelRatio: 2,
  },
  documentSize: {
    width: 1440,
    height: 1800,
  },
  elements: [
    {
      tagName: 'h1',
      text: 'Build faster',
      selector: 'main > section > h1',
      rect: { left: 120, top: 120, width: 640, height: 72 },
      sourceId: 'yak_heading',
      source: { file: 'src/components/Hero.tsx', line: 14, column: 7 },
    },
    {
      tagName: 'button',
      text: 'Start free',
      selector: 'main > section > button',
      rect: { left: 120, top: 320, width: 120, height: 42 },
      sourceId: 'yak_cta',
      source: { file: 'src/components/Hero.tsx', line: 22, column: 7 },
    },
  ],
  runtimeErrors: [],
  truncated: { elements: false, runtimeErrors: false },
};

const failedCritique: DesignCriticResult = {
  version: 1,
  status: 'FAIL',
  summary: 'The Hero hierarchy is too weak.',
  findings: [
    {
      area: 'visual-hierarchy',
      severity: 'major',
      message: 'The CTA is too detached from the primary message.',
      evidenceRefs: ['element:0', 'element:1'],
    },
  ],
  unverifiedAreas: ['color'],
};

const passedCritique: DesignCriticResult = {
  version: 1,
  status: 'PASS',
  summary: 'No concrete observable mismatch was found.',
  findings: [],
  unverifiedAreas: ['color'],
};

const passCheck: ToolResult<CheckProjectOutput> = {
  ok: true,
  value: {
    status: 'PASS',
    checks: [],
    diagnostics: [],
  },
};

const failCheck: ToolResult<CheckProjectOutput> = {
  ok: true,
  value: {
    status: 'FAIL',
    checks: [],
    diagnostics: [
      {
        phase: 'typecheck',
        message: 'Example compile failure',
        path: 'src/components/Hero.tsx',
      },
    ],
  },
};

const availableFiles = [
  'src/App.tsx',
  'src/components/Hero.tsx',
  'src/styles/theme.css',
];

test('prioritizes source-mapped critic evidence before changed and selected context', () => {
  const files = selectVisualRepairContextFiles(
    failedCritique,
    observation,
    ['src/styles/theme.css'],
    ['src/App.tsx', 'src/components/Hero.tsx'],
    availableFiles,
  );

  assert.deepEqual(files, [
    'src/components/Hero.tsx',
    'src/styles/theme.css',
    'src/App.tsx',
  ]);
});

test('builds one repair request with design, edit, critique, observation, and bounded source', () => {
  const request = buildVisualRepairRequest(
    'demo-project',
    'Make the Hero more premium without changing copy',
    designIntent,
    editIntent,
    failedCritique,
    observation,
    [
      {
        path: 'src/components/Hero.tsx',
        content: 'export function Hero() { return <h1>Build faster</h1>; }',
      },
    ],
  );
  const parsed = JSON.parse(request) as {
    userRequest: string;
    baselineDesignIntent: DesignIntentIR;
    editIntent: EditIntentDelta;
    critique: DesignCriticResult;
    project: { files: Array<{ path: string }> };
  };

  assert.equal(parsed.userRequest, 'Make the Hero more premium without changing copy');
  assert.equal(parsed.baselineDesignIntent.designDirection, designIntent.designDirection);
  assert.equal(parsed.editIntent.scope, 'section');
  assert.equal(parsed.critique.status, 'FAIL');
  assert.deepEqual(parsed.project.files.map((file) => file.path), ['src/components/Hero.tsx']);
});

test('rejects visual repair patches outside the bounded repair context', () => {
  const patch: ProjectPatch = {
    summary: 'Unexpected app rewrite',
    changes: [{ path: 'src/App.tsx', content: 'export default function App() { return null; }' }],
  };

  assert.throws(
    () => assertVisualRepairPatchUsesContext(patch, ['src/components/Hero.tsx']),
    /outside repair context/,
  );
});

test('does nothing when the Design Critic already passes', async () => {
  let calls = 0;
  const result = await runVisualRepairOnce({
    projectId: 'demo-project',
    userRequest: 'Polish the Hero',
    baselineDesignIntent: designIntent,
    editIntent,
    critique: passedCritique,
    pageObservation: observation,
    initialChangedFiles: ['src/components/Hero.tsx'],
    selectedContextFiles: ['src/components/Hero.tsx'],
    availableFiles,
    async readFiles() { calls += 1; return []; },
    async requestRepair() { calls += 1; return { content: '{}', model: 'test-model' }; },
    parsePatch() { calls += 1; throw new Error('should not parse'); },
    async applyPatch() { calls += 1; return []; },
    async checkProject() { calls += 1; return passCheck; },
  });

  assert.equal(result.status, 'NOT_NEEDED');
  assert.equal(result.attempted, false);
  assert.equal(calls, 0);
});

test('runs exactly one visual repair and one project check on success', async () => {
  let modelCalls = 0;
  let checkCalls = 0;

  const result = await runVisualRepairOnce({
    projectId: 'demo-project',
    userRequest: 'Make the Hero more premium without changing copy',
    baselineDesignIntent: designIntent,
    editIntent,
    critique: failedCritique,
    pageObservation: observation,
    initialChangedFiles: ['src/styles/theme.css'],
    selectedContextFiles: ['src/components/Hero.tsx', 'src/styles/theme.css'],
    availableFiles,
    async readFiles(paths) {
      return paths.map((path) => ({ path, content: `// ${path}` }));
    },
    async requestRepair() {
      modelCalls += 1;
      return {
        model: 'test-model',
        content: JSON.stringify({
          summary: 'Tighten the Hero hierarchy',
          changes: [
            {
              path: 'src/components/Hero.tsx',
              content: 'export function Hero() { return <h1>Build faster</h1>; }',
            },
          ],
        }),
      };
    },
    parsePatch(raw) {
      return JSON.parse(raw) as ProjectPatch;
    },
    async applyPatch(patch) {
      return patch.changes.map((change) => change.path);
    },
    async checkProject() {
      checkCalls += 1;
      return passCheck;
    },
  });

  assert.equal(result.status, 'REPAIRED');
  assert.deepEqual(result.changedFiles, ['src/components/Hero.tsx']);
  assert.equal(modelCalls, 1);
  assert.equal(checkCalls, 1);
});

test('stops after the single repair when the fixed project health check still fails', async () => {
  let modelCalls = 0;
  let checkCalls = 0;

  const result = await runVisualRepairOnce({
    projectId: 'demo-project',
    userRequest: 'Polish the Hero',
    baselineDesignIntent: designIntent,
    editIntent,
    critique: failedCritique,
    pageObservation: observation,
    initialChangedFiles: ['src/components/Hero.tsx'],
    selectedContextFiles: ['src/components/Hero.tsx'],
    availableFiles,
    async readFiles(paths) {
      return paths.map((path) => ({ path, content: `// ${path}` }));
    },
    async requestRepair() {
      modelCalls += 1;
      return {
        model: 'test-model',
        content: JSON.stringify({
          summary: 'Repair Hero',
          changes: [{ path: 'src/components/Hero.tsx', content: 'broken source' }],
        }),
      };
    },
    parsePatch(raw) {
      return JSON.parse(raw) as ProjectPatch;
    },
    async applyPatch(patch) {
      return patch.changes.map((change) => change.path);
    },
    async checkProject() {
      checkCalls += 1;
      return failCheck;
    },
  });

  assert.equal(result.status, 'FAILED');
  assert.equal(modelCalls, 1);
  assert.equal(checkCalls, 1);
  assert.match(result.error ?? '', /health check still failed/);
});
