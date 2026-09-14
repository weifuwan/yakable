import assert from 'node:assert/strict';
import test from 'node:test';

import type { DesignCriticResult } from '../src/editing/design-critic.js';
import type { EditIntentDelta } from '../src/editing/edit-intent.js';
import { runVisualRepairOnce } from '../src/editing/visual-repair.js';
import type { PageObservation } from '../src/runtime/page-observation.js';
import type { CheckProjectOutput } from '../src/tools/check-project.js';
import type { ToolResult } from '../src/tools/tool.js';
import type { ProjectPatch } from '../src/types.js';

const editIntent: EditIntentDelta = {
  version: 1,
  summary: 'Refine Hero hierarchy.',
  scope: 'section',
  targetHints: ['Hero'],
  directives: [
    {
      area: 'visual-hierarchy',
      directive: 'Strengthen heading and CTA hierarchy.',
      basis: 'interpreted',
    },
  ],
  preserve: [],
};

const observation: PageObservation = {
  version: 1,
  route: '/',
  viewport: {
    width: 1440,
    height: 900,
    scrollX: 0,
    scrollY: 0,
    devicePixelRatio: 1,
  },
  documentSize: { width: 1440, height: 1200 },
  elements: [
    {
      tagName: 'h1',
      text: 'Build faster',
      selector: 'main > h1',
      rect: { left: 100, top: 100, width: 600, height: 72 },
      source: { file: 'src/components/Hero.tsx', line: 10, column: 5 },
    },
  ],
  runtimeErrors: [],
  truncated: { elements: false, runtimeErrors: false },
};

const critique: DesignCriticResult = {
  version: 1,
  status: 'FAIL',
  summary: 'Hero hierarchy needs repair.',
  findings: [
    {
      area: 'visual-hierarchy',
      severity: 'major',
      message: 'The visible Hero hierarchy is too weak.',
      evidenceRefs: ['element:0'],
    },
  ],
  unverifiedAreas: [],
};

const failedCheck: ToolResult<CheckProjectOutput> = {
  ok: true,
  value: {
    status: 'FAIL',
    checks: [],
    diagnostics: [
      {
        phase: 'typecheck',
        message: 'Broken repair source',
        path: 'src/components/Hero.tsx',
      },
    ],
  },
};

test('rolls back the visual-repair source when its one health check fails', async () => {
  let restored: Array<{ path: string; content: string }> = [];
  const originalContent = 'export function Hero() { return <h1>Build faster</h1>; }';

  const result = await runVisualRepairOnce({
    projectId: 'demo-project',
    userRequest: 'Make the Hero more polished',
    baselineDesignIntent: null,
    editIntent,
    critique,
    pageObservation: observation,
    initialChangedFiles: ['src/components/Hero.tsx'],
    selectedContextFiles: ['src/components/Hero.tsx'],
    availableFiles: ['src/components/Hero.tsx'],
    async readFiles() {
      return [{ path: 'src/components/Hero.tsx', content: originalContent }];
    },
    async requestRepair() {
      return {
        model: 'test-model',
        content: JSON.stringify({
          summary: 'Repair Hero hierarchy',
          changes: [
            {
              path: 'src/components/Hero.tsx',
              content: 'export function Hero() { return <h1>broken',
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
      return failedCheck;
    },
    async restoreFiles(files) {
      restored = files;
    },
  });

  assert.equal(result.status, 'FAILED');
  assert.equal(result.rolledBack, true);
  assert.deepEqual(restored, [
    { path: 'src/components/Hero.tsx', content: originalContent },
  ]);
  assert.match(result.error ?? '', /rolled back/);
});
