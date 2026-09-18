import assert from 'node:assert/strict';
import test from 'node:test';

import { generateProject } from '../src/generation/generate.js';
import {
  ModeCapabilityError,
  assertModeCapability,
  capabilitiesForMode,
  createYakableModeContext,
  modeAllowsCapability,
  parseYakableMode,
} from '../src/modes/mode-contract.js';
import {
  beginEditRunInMode,
  executeApprovedPlanInMode,
  runModeCapability,
} from '../src/modes/mode-execution.js';
import type { BuildIntentDecision } from '../src/types.js';

const createDecision: BuildIntentDecision = {
  version: 1,
  route: 'CREATE',
  confidence: 'high',
  message: 'Create the requested frontend.',
};

test('parses PLAN and BUILD modes with BUILD as the compatibility default', () => {
  assert.equal(parseYakableMode('plan'), 'PLAN');
  assert.equal(parseYakableMode(' BUILD '), 'BUILD');
  assert.equal(parseYakableMode(undefined), 'BUILD');
  assert.throws(() => parseYakableMode('agent'), /PLAN or BUILD/);
});

test('PLAN exposes read-only source capabilities plus planning, diff, and review', () => {
  assert.deepEqual(capabilitiesForMode('PLAN'), [
    'read-project',
    'search-project',
    'observe-preview',
    'critique-design',
    'read-plan',
    'write-plan',
    'review-plan',
    'plan-ui',
    'diff-plan',
  ]);
  assert.equal(modeAllowsCapability('PLAN', 'read-project'), true);
  assert.equal(modeAllowsCapability('PLAN', 'critique-design'), true);
  assert.equal(modeAllowsCapability('PLAN', 'write-plan'), true);
  assert.equal(modeAllowsCapability('PLAN', 'review-plan'), true);
  assert.equal(modeAllowsCapability('PLAN', 'plan-ui'), true);
  assert.equal(modeAllowsCapability('PLAN', 'diff-plan'), true);
  assert.equal(modeAllowsCapability('PLAN', 'execute-plan'), false);
  assert.equal(modeAllowsCapability('PLAN', 'generate-source'), false);
  assert.equal(modeAllowsCapability('PLAN', 'edit-source'), false);
  assert.equal(modeAllowsCapability('PLAN', 'repair-source'), false);
});

test('BUILD may execute and read an approved plan but cannot silently revise, review, re-plan, or diff it', () => {
  const context = createYakableModeContext('BUILD');
  assert.equal(context.allows('read-plan'), true);
  assert.equal(context.allows('write-plan'), false);
  assert.equal(context.allows('review-plan'), false);
  assert.equal(context.allows('plan-ui'), false);
  assert.equal(context.allows('diff-plan'), false);
  assert.equal(context.allows('execute-plan'), true);
  assert.equal(context.allows('generate-source'), true);
  assert.equal(context.allows('edit-source'), true);
  assert.equal(context.allows('repair-source'), true);
  assert.doesNotThrow(() => context.assert('execute-plan'));
});

test('forbidden PLAN capability fails with a structured mode error', () => {
  assert.throws(
    () => assertModeCapability('PLAN', 'edit-source'),
    (error: unknown) => {
      assert.ok(error instanceof ModeCapabilityError);
      assert.equal(error.code, 'MODE_CAPABILITY_FORBIDDEN');
      assert.equal(error.mode, 'PLAN');
      assert.equal(error.capability, 'edit-source');
      return true;
    },
  );
});

test('mode capability gate rejects before running a mutation task', async () => {
  let called = false;
  await assert.rejects(
    runModeCapability('PLAN', 'repair-source', async () => {
      called = true;
      return 'mutated';
    }),
    /PLAN mode does not allow repair-source/,
  );
  assert.equal(called, false);
});

test('mode-aware project edit rejects PLAN before resolving or reading a project', async () => {
  await assert.rejects(
    beginEditRunInMode('PLAN', 'project-that-does-not-exist', 'Change the Hero'),
    /PLAN mode does not allow edit-source/,
  );
});

test('approved plan execution rejects PLAN before resolving or reading a project', async () => {
  await assert.rejects(
    executeApprovedPlanInMode('PLAN', 'project-that-does-not-exist'),
    /PLAN mode does not allow execute-plan/,
  );
});

test('project generation rejects PLAN before any generation model work', async () => {
  await assert.rejects(
    generateProject('Build a dashboard', {
      mode: 'PLAN',
      buildIntent: createDecision,
    }),
    /PLAN mode does not allow generate-source/,
  );
});
