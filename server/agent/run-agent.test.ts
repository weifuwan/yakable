import assert from 'node:assert/strict';
import test from 'node:test';

import { MockProvider } from '../ai/mock-provider.js';
import { readProjectFile } from '../project/project-store.js';
import { runAgent } from './run-agent.js';

test('mock agent turns a prompt into project source changes', async () => {
  const projectId = 'project_test_agent';
  const result = await runAgent(
    new MockProvider(),
    projectId,
    'Build a clean analytics landing page',
  );

  assert.deepEqual(result.changedFiles.sort(), ['src/App.tsx', 'src/index.css']);
  assert.ok(result.events.some((event) => event.tool === 'write_file' && event.status === 'success'));
  assert.match(readProjectFile(projectId, 'src/App.tsx').content, /analytics landing page/);
});
