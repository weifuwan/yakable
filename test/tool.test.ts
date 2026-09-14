import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { readProjectFileTool } from '../src/tools/read-project-file.js';
import { ToolRegistry } from '../src/tools/tool.js';

async function createProjectFixture(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'yakable-tool-'));
  await mkdir(path.join(directory, 'src'), { recursive: true });
  await mkdir(path.join(directory, 'dist'), { recursive: true });
  await writeFile(
    path.join(directory, 'src/App.tsx'),
    'export default function App() { return <main>Yakable</main>; }',
    'utf8',
  );
  await writeFile(path.join(directory, '.env'), 'SECRET=do-not-read', 'utf8');
  await writeFile(path.join(directory, 'dist/bundle.js'), 'compiled output', 'utf8');
  await writeFile(path.join(directory, 'src/binary.bin'), Buffer.from([1, 0, 2, 3]));
  return directory;
}

test('registers and executes a tool through ToolRegistry', async () => {
  const projectDirectory = await createProjectFixture();

  try {
    const registry = new ToolRegistry().register(readProjectFileTool);

    assert.equal(registry.has('read_project_file'), true);
    assert.deepEqual(registry.list(), [
      {
        name: 'read_project_file',
        description: 'Read one UTF-8 text file from the current generated frontend project.',
      },
    ]);

    const result = await registry.execute<{ path: string; content: string; bytes: number }>(
      'read_project_file',
      { path: 'src/App.tsx' },
      { projectDirectory },
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.path, 'src/App.tsx');
      assert.match(result.value.content, /Yakable/);
      assert.ok(result.value.bytes > 0);
    }
  } finally {
    await rm(projectDirectory, { recursive: true, force: true });
  }
});

test('returns a structured failure for an unknown tool', async () => {
  const registry = new ToolRegistry();
  const result = await registry.execute('missing_tool', {}, { projectDirectory: '/tmp' });

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: 'TOOL_NOT_FOUND',
      message: 'Tool is not registered: missing_tool',
    },
  });
});

test('rejects duplicate tool registration', () => {
  const registry = new ToolRegistry().register(readProjectFileTool);
  assert.throws(() => registry.register(readProjectFileTool), /already registered/);
});

test('read_project_file blocks unsafe and sensitive paths', async () => {
  const projectDirectory = await createProjectFixture();

  try {
    const traversal = await readProjectFileTool.execute(
      { path: '../outside.txt' },
      { projectDirectory },
    );
    assert.equal(traversal.ok, false);
    if (!traversal.ok) assert.equal(traversal.error.code, 'INVALID_PATH');

    const secret = await readProjectFileTool.execute(
      { path: '.env' },
      { projectDirectory },
    );
    assert.equal(secret.ok, false);
    if (!secret.ok) assert.equal(secret.error.code, 'SENSITIVE_PATH');

    const buildOutput = await readProjectFileTool.execute(
      { path: 'dist/bundle.js' },
      { projectDirectory },
    );
    assert.equal(buildOutput.ok, false);
    if (!buildOutput.ok) assert.equal(buildOutput.error.code, 'BLOCKED_PATH');
  } finally {
    await rm(projectDirectory, { recursive: true, force: true });
  }
});

test('read_project_file rejects binary files as text context', async () => {
  const projectDirectory = await createProjectFixture();

  try {
    const result = await readProjectFileTool.execute(
      { path: 'src/binary.bin' },
      { projectDirectory },
    );

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'BINARY_FILE');
  } finally {
    await rm(projectDirectory, { recursive: true, force: true });
  }
});
