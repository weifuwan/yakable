import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import type { DesignCriticResult } from '../src/editing/design-critic.js';
import type { EditIntentDelta } from '../src/editing/edit-intent.js';
import { runVisualRepairOnce } from '../src/editing/visual-repair.js';
import type { PageObservation } from '../src/runtime/page-observation.js';
import type { CheckProjectOutput } from '../src/tools/check-project.js';
import type { ToolResult } from '../src/tools/tool.js';
import type { ProjectPatch } from '../src/types.js';
import { WorkspaceChangeManager } from '../src/workspace/change-manager.js';
import { workspaceMutationsFromFiles } from '../src/workspace/change-set.js';

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

test('rolls back the exact visual-repair ChangeSet when health check fails', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yakable-visual-rollback-'));
  const heroPath = path.join(root, 'src/components/Hero.tsx');
  const originalContent = 'export function Hero() { return <h1>Build faster</h1>; }';
  await mkdir(path.dirname(heroPath), { recursive: true });
  await writeFile(heroPath, originalContent, 'utf8');
  const manager = new WorkspaceChangeManager(root);

  try {
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
        return [{ path: 'src/components/Hero.tsx', content: await readFile(heroPath, 'utf8') }];
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
      async applyChanges(patch) {
        return manager.apply(patch.summary, workspaceMutationsFromFiles(patch.changes));
      },
      async checkProject() {
        return failedCheck;
      },
      async rollback(changeSet) {
        await manager.rollback(changeSet);
      },
    });

    assert.equal(result.status, 'FAILED');
    assert.equal(result.rolledBack, true);
    assert.equal(await readFile(heroPath, 'utf8'), originalContent);
    assert.match(result.error ?? '', /rolled back/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
