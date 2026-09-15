import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  applyProjectChanges,
  assertPatchUsesSelectedContext,
  createProjectChangeManager,
  parseProjectPatch,
} from '../src/editing/project-change.js';
import {
  buildProjectEditContext,
  extractUserEditContext,
  extractUserEditRequest,
  listProjectContextFiles,
  readProjectSnapshot,
} from '../src/editing/project-context.js';
import type { ResolvedGeneratedProject } from '../src/runtime/runtime.js';
import type { ProjectSessionState } from '../src/types.js';
import { workspaceChangedPaths } from '../src/workspace/change-set.js';

async function createFixture(root: string): Promise<ResolvedGeneratedProject> {
  const directory = path.join(root, 'demo-project');
  await mkdir(path.join(directory, 'src/components'), { recursive: true });
  await mkdir(path.join(directory, 'dist'), { recursive: true });
  await writeFile(path.join(directory, 'package.json'), '{"name":"demo-project"}', 'utf8');
  await writeFile(path.join(directory, 'package-lock.json'), '{"lockfileVersion":3}', 'utf8');
  await writeFile(path.join(directory, 'index.html'), '<div id="root"></div>', 'utf8');
  await writeFile(path.join(directory, 'src/main.tsx'), 'import App from "./App";', 'utf8');
  await writeFile(
    path.join(directory, 'src/App.tsx'),
    'export default function App() { return <main>Before</main>; }',
    'utf8',
  );
  await writeFile(
    path.join(directory, 'src/components/Hero.tsx'),
    'export function Hero() { return <h1>Hero</h1>; }',
    'utf8',
  );
  await writeFile(path.join(directory, 'src/styles.css'), 'body { margin: 0; }', 'utf8');
  await writeFile(path.join(directory, '.env'), 'SECRET=do-not-send', 'utf8');
  await writeFile(path.join(directory, 'dist/bundle.js'), 'compiled output', 'utf8');
  return { directory, id: 'demo-project' };
}

test('parses a focused project change set request', () => {
  const patch = parseProjectPatch(
    JSON.stringify({
      summary: 'Update the Hero copy',
      changes: [
        {
          path: 'src/App.tsx',
          content: 'export default function App() { return <main>After</main>; }',
        },
      ],
    }),
  );

  assert.equal(patch.summary, 'Update the Hero copy');
  assert.deepEqual(patch.changes.map((change) => change.path), ['src/App.tsx']);
});

test('rejects root configuration and traversal changes', () => {
  assert.throws(
    () =>
      parseProjectPatch(
        JSON.stringify({ summary: 'bad', changes: [{ path: 'package.json', content: '{}' }] }),
      ),
    /can only modify src\/\*\*, public\/\*\*, or index.html/,
  );

  assert.throws(
    () =>
      parseProjectPatch(
        JSON.stringify({ summary: 'bad', changes: [{ path: '../escape.ts', content: 'x' }] }),
      ),
    /not safe/,
  );
});

test('lists context candidates without secrets, lockfiles, or build output', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'yakable-edit-candidates-'));
  try {
    const project = await createFixture(tempRoot);
    const paths = await listProjectContextFiles(project.directory);
    assert.ok(paths.includes('package.json'));
    assert.ok(paths.includes('src/App.tsx'));
    assert.ok(paths.includes('src/components/Hero.tsx'));
    assert.ok(!paths.includes('package-lock.json'));
    assert.ok(!paths.includes('.env'));
    assert.ok(!paths.includes('dist/bundle.js'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('reads only the selected project context files', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'yakable-edit-context-'));
  try {
    const project = await createFixture(tempRoot);
    const snapshot = await readProjectSnapshot(project, [
      'src/components/Hero.tsx',
      'src/styles.css',
    ]);
    assert.deepEqual(
      snapshot.files.map((file) => file.path),
      ['src/components/Hero.tsx', 'src/styles.css'],
    );
    assert.ok(!snapshot.files.some((file) => file.content.includes('Before')));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('includes original intent and recent accepted edits in follow-up context', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'yakable-edit-continuity-'));
  try {
    const project = await createFixture(tempRoot);
    const snapshot = await readProjectSnapshot(project, ['src/App.tsx']);
    const session: ProjectSessionState = {
      version: 1,
      productRequest: 'Build a restrained developer tool landing page',
      initialSummary: 'Generated landing page',
      createdAt: '2026-09-14T02:00:00.000Z',
      updatedAt: '2026-09-14T02:05:00.000Z',
      edits: [
        {
          id: 'edit-1',
          createdAt: '2026-09-14T02:05:00.000Z',
          userRequest: 'Remove all shadows',
          assistantSummary: 'Removed shadows',
          changedFiles: ['src/styles.css'],
        },
      ],
    };

    const context = JSON.parse(
      buildProjectEditContext(snapshot, 'Make the logo larger', session),
    ) as {
      followUpRequest: string;
      continuity: {
        originalProductRequest: string;
        recentEdits: Array<{ userRequest: string }>;
      };
      project: { files: Array<{ path: string }> };
    };

    assert.equal(context.followUpRequest, 'Make the logo larger');
    assert.equal(
      context.continuity.originalProductRequest,
      'Build a restrained developer tool landing page',
    );
    assert.equal(context.continuity.recentEdits[0]?.userRequest, 'Remove all shadows');
    assert.deepEqual(context.project.files.map((file) => file.path), ['src/App.tsx']);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('extracts the human request and source-mapped visual targets for persistence', () => {
  const request = `${'[[YAKABLE_VISUAL_EDIT_REQUEST]]'}\n${JSON.stringify({
    userRequest: 'Make this heading larger',
    visualSelections: {
      selectedCount: 1,
      targets: [
        {
          sourceId: 'yak_heading',
          file: 'src/components/Hero.tsx',
          line: 37,
          column: 5,
          tagName: 'h1',
          instances: [
            {
              runtimeId: 'runtime-1',
              text: 'Build something great',
              selector: 'main > section > h1',
            },
          ],
        },
      ],
      unmappedSelections: [],
    },
  })}\n${'[[/YAKABLE_VISUAL_EDIT_REQUEST]]'}`;

  const extracted = extractUserEditContext(request);
  assert.equal(extracted.userRequest, 'Make this heading larger');
  assert.deepEqual(extracted.visualSelections, [
    {
      sourceId: 'yak_heading',
      file: 'src/components/Hero.tsx',
      line: 37,
      column: 5,
      tagName: 'h1',
      text: 'Build something great',
      selector: 'main > section > h1',
    },
  ]);
  assert.equal(extractUserEditRequest(request), 'Make this heading larger');
  assert.equal(extractUserEditRequest('Tighten the hero spacing'), 'Tighten the hero spacing');
});

test('rejects changes to existing files that were not selected as context', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'yakable-edit-context-guard-'));
  try {
    const project = await createFixture(tempRoot);
    const patch = parseProjectPatch(
      JSON.stringify({
        summary: 'Unexpected style rewrite',
        changes: [{ path: 'src/styles.css', content: 'body { margin: 4px; }' }],
      }),
    );
    await assert.rejects(
      () => assertPatchUsesSelectedContext(project, patch, ['src/App.tsx']),
      /outside selected context/,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('allows a selected existing file and a genuinely new file', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'yakable-edit-context-new-file-'));
  try {
    const project = await createFixture(tempRoot);
    const patch = parseProjectPatch(
      JSON.stringify({
        summary: 'Change the app and add a badge',
        changes: [
          {
            path: 'src/App.tsx',
            content: 'export default function App() { return <main>After</main>; }',
          },
          {
            path: 'src/components/Badge.tsx',
            content: 'export function Badge() { return <span>New</span>; }',
          },
        ],
      }),
    );
    await assert.doesNotReject(() =>
      assertPatchUsesSelectedContext(project, patch, ['src/App.tsx']),
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('applies project edits as a WorkspaceChangeSet and preserves unrelated source', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'yakable-edit-apply-'));
  try {
    const project = await createFixture(tempRoot);
    const beforeStyles = await readFile(path.join(project.directory, 'src/styles.css'), 'utf8');
    const patch = parseProjectPatch(
      JSON.stringify({
        summary: 'Change the main copy and add a badge',
        changes: [
          {
            path: 'src/App.tsx',
            content: 'export default function App() { return <main>After</main>; }',
          },
          {
            path: 'src/components/Badge.tsx',
            content: 'export function Badge() { return <span>New</span>; }',
          },
        ],
      }),
    );

    const changeSet = await applyProjectChanges(createProjectChangeManager(project), patch);
    const afterApp = await readFile(path.join(project.directory, 'src/App.tsx'), 'utf8');
    const afterStyles = await readFile(path.join(project.directory, 'src/styles.css'), 'utf8');

    assert.deepEqual(workspaceChangedPaths(changeSet), ['src/App.tsx', 'src/components/Badge.tsx']);
    assert.deepEqual(changeSet.files.map((file) => file.type), ['MODIFIED', 'ADDED']);
    assert.match(afterApp, /After/);
    assert.equal(afterStyles, beforeStyles);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
