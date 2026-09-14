import assert from 'node:assert/strict';
import test from 'node:test';

import type { DesignCriticRun } from '../src/editing/design-critic.js';
import type { EditIntentDelta } from '../src/editing/edit-intent.js';
import type { VisualRepairResult } from '../src/editing/visual-repair.js';
import type { PageObservation } from '../src/runtime/page-observation.js';
import {
  createYakableApiServer,
  type RuntimeSession,
  type WebApiServices,
} from '../src/server/web-api.js';
import type { BuildIntentDecision } from '../src/types.js';

const editIntent: EditIntentDelta = {
  version: 1,
  summary: 'Refine the Hero hierarchy.',
  scope: 'section',
  targetHints: ['Hero'],
  directives: [
    {
      area: 'visual-hierarchy',
      directive: 'Strengthen the primary hierarchy.',
      basis: 'interpreted',
    },
  ],
  preserve: [],
};

const pageObservation: PageObservation = {
  version: 1,
  route: '/',
  viewport: {
    width: 1440,
    height: 900,
    scrollX: 0,
    scrollY: 0,
    devicePixelRatio: 1,
  },
  documentSize: { width: 1440, height: 1400 },
  elements: [
    {
      tagName: 'h1',
      text: 'Build faster',
      selector: 'main > h1',
      rect: { left: 120, top: 100, width: 620, height: 72 },
      source: { file: 'src/components/Hero.tsx', line: 12, column: 5 },
    },
  ],
  runtimeErrors: [],
  truncated: { elements: false, runtimeErrors: false },
};

const critique: DesignCriticRun = {
  model: 'test-model',
  result: {
    version: 1,
    status: 'FAIL',
    summary: 'The Hero hierarchy needs one repair.',
    findings: [
      {
        area: 'visual-hierarchy',
        severity: 'major',
        message: 'The current heading hierarchy is too weak.',
        evidenceRefs: ['element:0'],
      },
    ],
    unverifiedAreas: [],
  },
};

const visualRepair: VisualRepairResult = {
  attempted: true,
  status: 'REPAIRED',
  contextFiles: ['src/components/Hero.tsx'],
  changedFiles: ['src/components/Hero.tsx'],
  projectCheck: {
    ok: true,
    value: {
      status: 'PASS',
      checks: [],
      diagnostics: [],
    },
  },
  rolledBack: false,
  model: 'test-model',
  summary: 'Repaired the Hero hierarchy.',
};

function services(): WebApiServices {
  const decision: BuildIntentDecision = {
    version: 1,
    route: 'CREATE',
    confidence: 'high',
    message: 'Create project.',
  };
  let alive = false;
  const runtime: RuntimeSession = {
    url: 'http://127.0.0.1:59001/',
    metadata: {
      version: 1,
      template: 'website',
      routes: [{ path: '/', title: 'Home' }],
    },
    isAlive: () => alive,
    async close() {
      alive = false;
    },
  };

  return {
    async listProjects() {
      return [];
    },
    async gateBuildIntent() {
      return decision;
    },
    async generate() {
      return {
        id: 'demo-project',
        name: 'Demo Project',
        summary: 'Demo',
        model: 'test-model',
        template: 'website',
        routes: [{ path: '/', title: 'Home' }],
        session: null,
        conversation: null,
      };
    },
    async edit(projectId) {
      return {
        projectId,
        summary: 'Edited',
        model: 'test-model',
        changedFiles: ['src/components/Hero.tsx'],
        session: null,
        conversation: null,
      };
    },
    async startRuntime() {
      alive = true;
      return runtime;
    },
    async critique(projectId, receivedEditIntent, receivedObservation) {
      assert.equal(projectId, 'demo-project');
      assert.deepEqual(receivedEditIntent, editIntent);
      assert.deepEqual(receivedObservation, pageObservation);
      return critique;
    },
    async visualRepair(projectId, input) {
      assert.equal(projectId, 'demo-project');
      assert.equal(input.userRequest, 'Polish the Hero');
      assert.deepEqual(input.editIntent, editIntent);
      assert.deepEqual(input.pageObservation, pageObservation);
      assert.equal(input.critique.status, 'FAIL');
      assert.deepEqual(input.initialChangedFiles, ['src/components/Hero.tsx']);
      assert.deepEqual(input.selectedContextFiles, ['src/components/Hero.tsx']);
      return visualRepair;
    },
  };
}

test('web API exposes bounded critique and one visual repair boundary', async () => {
  const api = createYakableApiServer({ services: services() });
  const baseUrl = await api.listen(0);

  try {
    const critiqueResponse = await fetch(`${baseUrl}/api/projects/demo-project/critique`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editIntent, pageObservation }),
    });
    assert.equal(critiqueResponse.status, 200);
    const critiquePayload = await critiqueResponse.json() as { critique: DesignCriticRun };
    assert.equal(critiquePayload.critique.result.status, 'FAIL');
    assert.deepEqual(
      critiquePayload.critique.result.findings[0]?.evidenceRefs,
      ['element:0'],
    );

    const repairResponse = await fetch(`${baseUrl}/api/projects/demo-project/visual-repair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userRequest: 'Polish the Hero',
        editIntent,
        critique: critique.result,
        pageObservation,
        initialChangedFiles: ['src/components/Hero.tsx'],
        selectedContextFiles: ['src/components/Hero.tsx'],
      }),
    });
    assert.equal(repairResponse.status, 200);
    const repairPayload = await repairResponse.json() as {
      visualRepair: VisualRepairResult;
      previewUrl: string;
    };
    assert.equal(repairPayload.visualRepair.status, 'REPAIRED');
    assert.equal(repairPayload.visualRepair.rolledBack, false);
    assert.match(repairPayload.previewUrl, /revision=/);
  } finally {
    await api.close();
  }
});
