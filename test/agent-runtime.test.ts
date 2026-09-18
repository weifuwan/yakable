import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentRuntime } from '../src/agent-runtime/agent-runtime.js';
import { createAgentRunContext } from '../src/agent-runtime/run-context.js';
import { ToolRouter } from '../src/agent-runtime/tool-router.js';
import type { ApprovedPlanWorkflowResult } from '../src/agent-runtime/workflows/approved-plan-workflow.js';
import type { ModelClient } from '../src/model/model-client.js';
import type { Tool } from '../src/tools/tool.js';
import type { GenerationResult } from '../src/types.js';

const modelClient: ModelClient = {
  id: 'test-model',
  async generateStructured() {
    return { content: '{}', model: 'test-model' };
  },
};

const editTool: Tool<{ value: string }, string> = {
  name: 'edit_source_fixture',
  description: 'Test-only write-capable tool.',
  async execute(input) {
    return { ok: true, value: input.value };
  },
};

test('creates a normalized run context with runtime surfaces', () => {
  const context = createAgentRunContext({
    operation: 'EDIT',
    projectInput: ' generated/example ',
    prompt: '  Make the hero clearer  ',
    modelClientId: 'deepseek',
    availableTools: ['read_project_file', 'read_project_file', 'check_project'],
    startedAt: '2026-09-15T00:00:00.000Z',
  });

  assert.equal(context.operation, 'EDIT');
  assert.equal(context.projectInput, 'generated/example');
  assert.equal(context.prompt, 'Make the hero clearer');
  assert.equal(context.modelClientId, 'deepseek');
  assert.deepEqual(context.availableTools, ['read_project_file', 'check_project']);
});

test('ToolRouter exposes and executes explicitly registered tools', async () => {
  const router = new ToolRouter().register(editTool);

  assert.deepEqual(router.list(), [
    {
      name: editTool.name,
      description: editTool.description,
    },
  ]);

  const result = await router.execute<string>(
    editTool.name,
    { value: 'applied' },
    { projectDirectory: '/tmp/project' },
  );
  assert.deepEqual(result, { ok: true, value: 'applied' });
});

test('AgentRuntime owns create and approved-plan workflow entry points', async () => {
  const calls: string[] = [];
  const generationResult = { marker: 'create-result' } as unknown as GenerationResult;
  const approvedPlanResult = { marker: 'plan-result' } as unknown as ApprovedPlanWorkflowResult;
  const router = new ToolRouter().register(editTool);

  const runtime = new AgentRuntime({
    modelClient,
    toolRouter: router,
    now: () => new Date('2026-09-15T00:00:00.000Z'),
    async createProject(prompt) {
      calls.push(`create:${prompt}`);
      return generationResult;
    },
    async executeApprovedPlan(projectInput) {
      calls.push(`approved-plan:${projectInput}`);
      return approvedPlanResult;
    },
  });

  const context = runtime.createContext({
    operation: 'CREATE',
    prompt: '  Build a dashboard  ',
  });
  assert.equal(context.startedAt, '2026-09-15T00:00:00.000Z');
  assert.equal(context.modelClientId, 'test-model');
  assert.deepEqual(context.availableTools, [editTool.name]);

  assert.equal(await runtime.createProject('  Build a dashboard  '), generationResult);
  assert.equal(await runtime.executeApprovedPlan(' generated/example '), approvedPlanResult);
  assert.deepEqual(calls, [
    'create:Build a dashboard',
    'approved-plan:generated/example',
  ]);
});
