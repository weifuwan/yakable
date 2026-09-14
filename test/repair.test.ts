import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertRepairPatchUsesContext,
  buildOneShotRepairRequest,
  runOneShotRepair,
  selectOneShotRepairContextFiles,
} from '../src/editing/repair.js';
import type { CheckProjectOutput } from '../src/tools/check-project.js';
import type { ToolResult } from '../src/tools/tool.js';
import type { ProjectPatch } from '../src/types.js';

function passCheck(): ToolResult<CheckProjectOutput> {
  return {
    ok: true,
    value: {
      status: 'PASS',
      checks: [
        { phase: 'typecheck', status: 'PASS', exitCode: 0, timedOut: false, outputTruncated: false },
        { phase: 'build', status: 'PASS', exitCode: 0, timedOut: false, outputTruncated: false },
      ],
      diagnostics: [],
    },
  };
}

function failCheck(path = 'src/components/Hero.tsx'): ToolResult<CheckProjectOutput> {
  return {
    ok: true,
    value: {
      status: 'FAIL',
      checks: [
        { phase: 'typecheck', status: 'FAIL', exitCode: 2, timedOut: false, outputTruncated: false },
      ],
      diagnostics: [
        {
          phase: 'typecheck',
          path,
          line: 12,
          column: 7,
          code: 'TS2304',
          message: 'Cannot find name Button.',
        },
      ],
    },
  };
}

function parsePatch(rawContent: string): ProjectPatch {
  return JSON.parse(rawContent) as ProjectPatch;
}

test('repair context prioritizes changed files, diagnostics, then original context', () => {
  const files = selectOneShotRepairContextFiles(
    ['src/components/Hero.tsx', 'src/components/NewBadge.tsx'],
    failCheck('src/styles/theme.css'),
    ['src/App.tsx', 'src/styles/theme.css', 'src/routes.ts'],
    ['src/App.tsx', 'src/styles/theme.css', 'src/routes.ts'],
  );

  assert.deepEqual(files, [
    'src/components/Hero.tsx',
    'src/components/NewBadge.tsx',
    'src/styles/theme.css',
    'src/App.tsx',
    'src/routes.ts',
  ]);
});

test('repair request contains failed observation and only supplied repair files', () => {
  const request = JSON.parse(
    buildOneShotRepairRequest(
      'demo-project',
      'Make the hero blue',
      'Updated hero styling',
      failCheck(),
      [{ path: 'src/components/Hero.tsx', content: 'export function Hero() { return null; }' }],
    ),
  ) as {
    userRequest: string;
    initialEditSummary: string;
    projectCheck: CheckProjectOutput;
    project: { id: string; files: Array<{ path: string }> };
  };

  assert.equal(request.userRequest, 'Make the hero blue');
  assert.equal(request.initialEditSummary, 'Updated hero styling');
  assert.equal(request.projectCheck.status, 'FAIL');
  assert.equal(request.project.id, 'demo-project');
  assert.deepEqual(request.project.files.map((file) => file.path), ['src/components/Hero.tsx']);
});

test('repair patch cannot modify files outside repair context', () => {
  assert.throws(
    () =>
      assertRepairPatchUsesContext(
        {
          summary: 'bad repair',
          changes: [{ path: 'src/App.tsx', content: 'export default null;' }],
        },
        ['src/components/Hero.tsx'],
      ),
    /outside repair context/,
  );
});

test('does not call repair model when initial project check passes', async () => {
  let repairCalls = 0;
  let finalCheckCalls = 0;

  const result = await runOneShotRepair({
    projectId: 'demo-project',
    userRequest: 'Make the hero blue',
    initialEditSummary: 'Updated hero',
    initialChangedFiles: ['src/components/Hero.tsx'],
    selectedContextFiles: ['src/components/Hero.tsx'],
    availableFiles: ['src/components/Hero.tsx'],
    initialCheck: passCheck(),
    readFiles: async () => [],
    requestRepair: async () => {
      repairCalls += 1;
      return { content: '{}', model: 'test-model' };
    },
    parsePatch,
    applyPatch: async () => [],
    checkProject: async () => {
      finalCheckCalls += 1;
      return passCheck();
    },
  });

  assert.equal(result.status, 'NOT_NEEDED');
  assert.equal(result.attempted, false);
  assert.equal(repairCalls, 0);
  assert.equal(finalCheckCalls, 0);
});

test('applies exactly one repair and checks once when repair succeeds', async () => {
  let repairCalls = 0;
  let applyCalls = 0;
  let finalCheckCalls = 0;

  const result = await runOneShotRepair({
    projectId: 'demo-project',
    userRequest: 'Make the hero blue',
    initialEditSummary: 'Updated hero',
    initialChangedFiles: ['src/components/Hero.tsx'],
    selectedContextFiles: ['src/components/Hero.tsx', 'src/App.tsx'],
    availableFiles: ['src/components/Hero.tsx', 'src/App.tsx'],
    initialCheck: failCheck(),
    readFiles: async (paths) => paths.map((path) => ({ path, content: `// ${path}` })),
    requestRepair: async () => {
      repairCalls += 1;
      return {
        model: 'test-repair-model',
        content: JSON.stringify({
          summary: 'Restore the missing Button import',
          changes: [{ path: 'src/components/Hero.tsx', content: '// repaired' }],
        }),
      };
    },
    parsePatch,
    applyPatch: async (patch) => {
      applyCalls += 1;
      return patch.changes.map((change) => change.path);
    },
    checkProject: async () => {
      finalCheckCalls += 1;
      return passCheck();
    },
  });

  assert.equal(result.status, 'REPAIRED');
  assert.equal(result.attempted, true);
  assert.equal(repairCalls, 1);
  assert.equal(applyCalls, 1);
  assert.equal(finalCheckCalls, 1);
  assert.deepEqual(result.changedFiles, ['src/components/Hero.tsx']);
  assert.equal(result.finalCheck.ok && result.finalCheck.value.status, 'PASS');
});

test('stops after one failed repair without looping', async () => {
  let repairCalls = 0;
  let applyCalls = 0;
  let finalCheckCalls = 0;

  const result = await runOneShotRepair({
    projectId: 'demo-project',
    userRequest: 'Make the hero blue',
    initialEditSummary: 'Updated hero',
    initialChangedFiles: ['src/components/Hero.tsx'],
    selectedContextFiles: ['src/components/Hero.tsx'],
    availableFiles: ['src/components/Hero.tsx'],
    initialCheck: failCheck(),
    readFiles: async (paths) => paths.map((path) => ({ path, content: '// broken' })),
    requestRepair: async () => {
      repairCalls += 1;
      return {
        model: 'test-repair-model',
        content: JSON.stringify({
          summary: 'Tried a repair',
          changes: [{ path: 'src/components/Hero.tsx', content: '// still broken' }],
        }),
      };
    },
    parsePatch,
    applyPatch: async (patch) => {
      applyCalls += 1;
      return patch.changes.map((change) => change.path);
    },
    checkProject: async () => {
      finalCheckCalls += 1;
      return failCheck();
    },
  });

  assert.equal(result.status, 'FAILED');
  assert.equal(repairCalls, 1);
  assert.equal(applyCalls, 1);
  assert.equal(finalCheckCalls, 1);
  assert.equal(result.finalCheck.ok && result.finalCheck.value.status, 'FAIL');
});

test('skips repair when the initial check tool itself errors', async () => {
  let repairCalls = 0;
  const initialCheck: ToolResult<CheckProjectOutput> = {
    ok: false,
    error: { code: 'CHECK_EXECUTION_FAILED', message: 'toolchain unavailable' },
  };

  const result = await runOneShotRepair({
    projectId: 'demo-project',
    userRequest: 'Make the hero blue',
    initialEditSummary: 'Updated hero',
    initialChangedFiles: ['src/components/Hero.tsx'],
    selectedContextFiles: ['src/components/Hero.tsx'],
    availableFiles: ['src/components/Hero.tsx'],
    initialCheck,
    readFiles: async () => [],
    requestRepair: async () => {
      repairCalls += 1;
      return { content: '{}', model: 'test-model' };
    },
    parsePatch,
    applyPatch: async () => [],
    checkProject: async () => passCheck(),
  });

  assert.equal(result.status, 'SKIPPED');
  assert.equal(result.attempted, false);
  assert.equal(repairCalls, 0);
});
