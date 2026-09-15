import assert from 'node:assert/strict';
import test from 'node:test';

import { TurnDiffTracker } from '../src/workspace/turn-diff.js';
import type { WorkspaceChangeSet } from '../src/workspace/change-set.js';

function changeSet(
  id: string,
  files: WorkspaceChangeSet['files'],
): WorkspaceChangeSet {
  return {
    id,
    summary: id,
    createdAt: '2026-09-15T00:00:00.000Z',
    files,
  };
}

test('TurnDiffTracker keeps the first before state and latest after state across repairs', async () => {
  const tracker = new TurnDiffTracker();

  tracker.record(changeSet('initial', [
    {
      path: 'src/App.tsx',
      type: 'MODIFIED',
      beforeContent: 'export default function App() { return <h1>Old</h1>; }\n',
      afterContent: 'export default function App() { return <h1>New</h1>; }\n',
    },
    {
      path: 'src/components/Hero.tsx',
      type: 'ADDED',
      beforeContent: null,
      afterContent: 'export function Hero() { return <section>First</section>; }\n',
    },
  ]));

  tracker.record(changeSet('repair', [
    {
      path: 'src/App.tsx',
      type: 'MODIFIED',
      beforeContent: 'export default function App() { return <h1>New</h1>; }\n',
      afterContent: 'export default function App() { return <h1>Better</h1>; }\n',
    },
    {
      path: 'src/components/Hero.tsx',
      type: 'MODIFIED',
      beforeContent: 'export function Hero() { return <section>First</section>; }\n',
      afterContent: 'export function Hero() { return <section>Final</section>; }\n',
    },
  ]));

  const diff = await tracker.snapshot();
  assert.equal(diff.files.length, 2);
  assert.deepEqual(diff.files[0], {
    path: 'src/App.tsx',
    type: 'MODIFIED',
    beforeContent: 'export default function App() { return <h1>Old</h1>; }\n',
    afterContent: 'export default function App() { return <h1>Better</h1>; }\n',
  });
  assert.deepEqual(diff.files[1], {
    path: 'src/components/Hero.tsx',
    type: 'ADDED',
    beforeContent: null,
    afterContent: 'export function Hero() { return <section>Final</section>; }\n',
  });
  assert.match(diff.unifiedDiff, /src\/App\.tsx/);
  assert.match(diff.unifiedDiff, /src\/components\/Hero\.tsx/);
  assert.ok(diff.addedLines > 0);
  assert.ok(diff.removedLines > 0);
});

test('TurnDiffTracker removes a path when a run returns it to the original state', async () => {
  const tracker = new TurnDiffTracker();
  tracker.record(changeSet('initial', [
    {
      path: 'src/App.tsx',
      type: 'MODIFIED',
      beforeContent: 'old\n',
      afterContent: 'new\n',
    },
  ]));
  tracker.record(changeSet('revert', [
    {
      path: 'src/App.tsx',
      type: 'MODIFIED',
      beforeContent: 'new\n',
      afterContent: 'old\n',
    },
  ]));

  assert.equal(tracker.isEmpty(), true);
  assert.deepEqual(await tracker.snapshot(), {
    files: [],
    unifiedDiff: '',
    addedLines: 0,
    removedLines: 0,
  });
});
