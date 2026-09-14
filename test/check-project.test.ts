import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  checkProjectDirectory,
  checkProjectTool,
  parseProjectCheckDiagnostics,
  type ProjectCheckPhase,
  type ProjectCheckRunner,
} from '../src/tools/check-project.js';

async function createProjectFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yakable-project-check-'));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'tsconfig.json'), '{"compilerOptions":{}}', 'utf8');
  await writeFile(path.join(root, 'index.html'), '<div id="root"></div>', 'utf8');
  await writeFile(path.join(root, 'src/App.tsx'), 'export default function App() { return null; }', 'utf8');
  return root;
}

function result(exitCode: number, stderr = '', stdout = '') {
  return {
    exitCode,
    stdout,
    stderr,
    timedOut: false,
    outputTruncated: false,
  };
}

test('parses TypeScript diagnostics into project-relative structured errors', () => {
  const project = path.resolve('/tmp/yakable-demo');
  const diagnostics = parseProjectCheckDiagnostics(
    'typecheck',
    `${path.join(project, 'src/App.tsx')}(12,7): error TS2322: Type 'string' is not assignable to type 'number'.`,
    project,
  );

  assert.deepEqual(diagnostics, [
    {
      phase: 'typecheck',
      path: 'src/App.tsx',
      line: 12,
      column: 7,
      code: 'TS2322',
      message: "Type 'string' is not assignable to type 'number'.",
    },
  ]);
});

test('reports PASS after typecheck and build both succeed', async () => {
  const project = await createProjectFixture();
  const phases: ProjectCheckPhase[] = [];
  const runner: ProjectCheckRunner = async (phase) => {
    phases.push(phase);
    return result(0);
  };

  try {
    const check = await checkProjectDirectory(project, runner);
    assert.equal(check.ok, true);
    if (!check.ok) return;

    assert.equal(check.value.status, 'PASS');
    assert.deepEqual(phases, ['typecheck', 'build']);
    assert.deepEqual(check.value.checks.map((item) => item.status), ['PASS', 'PASS']);
    assert.deepEqual(check.value.diagnostics, []);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test('stops after a failed typecheck and returns diagnostics without running build', async () => {
  const project = await createProjectFixture();
  const phases: ProjectCheckPhase[] = [];
  const runner: ProjectCheckRunner = async (phase, directory) => {
    phases.push(phase);
    return result(
      2,
      `${path.join(directory, 'src/App.tsx')}(4,3): error TS2304: Cannot find name 'missingValue'.`,
    );
  };

  try {
    const check = await checkProjectDirectory(project, runner);
    assert.equal(check.ok, true);
    if (!check.ok) return;

    assert.equal(check.value.status, 'FAIL');
    assert.deepEqual(phases, ['typecheck']);
    assert.equal(check.value.checks[0]?.phase, 'typecheck');
    assert.equal(check.value.diagnostics[0]?.code, 'TS2304');
    assert.equal(check.value.diagnostics[0]?.path, 'src/App.tsx');
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test('reports build failure after a successful typecheck', async () => {
  const project = await createProjectFixture();
  const phases: ProjectCheckPhase[] = [];
  const runner: ProjectCheckRunner = async (phase) => {
    phases.push(phase);
    if (phase === 'typecheck') return result(0);
    return result(1, 'error during build:\nCould not resolve "./Missing" from "src/App.tsx"');
  };

  try {
    const check = await checkProjectDirectory(project, runner);
    assert.equal(check.ok, true);
    if (!check.ok) return;

    assert.equal(check.value.status, 'FAIL');
    assert.deepEqual(phases, ['typecheck', 'build']);
    assert.equal(check.value.checks[1]?.phase, 'build');
    assert.equal(check.value.checks[1]?.status, 'FAIL');
    assert.ok(check.value.diagnostics.some((item) => /Could not resolve/i.test(item.message)));
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test('returns a Tool error when the project cannot be checked', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yakable-project-check-invalid-'));
  try {
    const check = await checkProjectDirectory(root, async () => result(0));
    assert.equal(check.ok, false);
    if (check.ok) return;
    assert.equal(check.error.code, 'INVALID_PROJECT');
    assert.match(check.error.message, /tsconfig\.json/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects arbitrary check_project input instead of accepting commands', async () => {
  const check = await checkProjectTool.execute('npm run anything', {
    projectDirectory: '/tmp/unused',
  });
  assert.equal(check.ok, false);
  if (check.ok) return;
  assert.equal(check.error.code, 'INVALID_INPUT');
});
