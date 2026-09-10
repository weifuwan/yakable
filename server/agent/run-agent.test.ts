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

test('follow-up turn edits the existing project with replace_in_file', async () => {
  const projectId = 'project_test_incremental_agent';
  const provider = new MockProvider();
  const first = await runAgent(provider, projectId, 'Build a dark SaaS landing page');
  const before = readProjectFile(projectId, 'src/App.tsx').content;

  const second = await runAgent(
    provider,
    projectId,
    'Change the product message to focus on teams',
    [
      { role: 'user', content: 'Build a dark SaaS landing page' },
      { role: 'assistant', content: first.message },
    ],
  );
  const after = readProjectFile(projectId, 'src/App.tsx').content;

  assert.deepEqual(second.changedFiles, ['src/App.tsx']);
  assert.ok(
    second.events.some(
      (event) => event.tool === 'replace_in_file' && event.status === 'success',
    ),
  );
  assert.notEqual(after, before);
  assert.match(after, /focus on teams/);
  assert.match(after, /Your idea keeps getting better/);
});
