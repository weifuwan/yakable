import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ContextBuilder,
  createContextBudget,
  type ContextProvider,
} from '../src/context/index.js';

test('creates an explicit input budget while reserving model output capacity', () => {
  assert.deepEqual(
    createContextBudget({
      maxContextTokens: 128_000,
      reservedOutputTokens: 16_000,
    }),
    {
      maxContextTokens: 128_000,
      reservedOutputTokens: 16_000,
      maxInputTokens: 112_000,
    },
  );

  assert.throws(
    () => createContextBudget({ maxContextTokens: 16_000, reservedOutputTokens: 16_000 }),
    /reservedOutputTokens must be smaller than maxContextTokens/,
  );
});

test('builds a deterministic snapshot from bounded context providers', async () => {
  const seenRequests: string[] = [];
  const providers: ContextProvider[] = [
    {
      id: 'project-state',
      provide(input) {
        seenRequests.push(`${input.operation}:${input.request}:${input.projectInput}`);
        return {
          id: 'project',
          kind: 'PROJECT',
          priority: 'HIGH',
          pinned: true,
          content: {
            hasGeneratedUi: true,
            relevantFiles: ['src/App.tsx'],
          },
        };
      },
    },
    {
      id: 'conversation',
      provide() {
        return [
          {
            id: 'recent-conversation',
            kind: 'CONVERSATION',
            priority: 'NORMAL',
            content: '  User asked to keep the existing layout.  ',
          },
        ];
      },
    },
  ];

  const builder = new ContextBuilder({
    budget: createContextBudget({
      maxContextTokens: 128_000,
      reservedOutputTokens: 16_000,
    }),
    providers,
    now: () => new Date('2026-09-15T00:00:00.000Z'),
  });

  const snapshot = await builder.build({
    operation: 'EDIT',
    request: '  Make the hero clearer  ',
    projectInput: ' generated/example ',
  });

  assert.deepEqual(seenRequests, [
    'EDIT:Make the hero clearer:generated/example',
  ]);
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.operation, 'EDIT');
  assert.equal(snapshot.request, 'Make the hero clearer');
  assert.equal(snapshot.projectInput, 'generated/example');
  assert.equal(snapshot.createdAt, '2026-09-15T00:00:00.000Z');
  assert.equal(snapshot.budget.maxInputTokens, 112_000);
  assert.deepEqual(snapshot.sections, [
    {
      id: 'project',
      source: 'project-state',
      kind: 'PROJECT',
      priority: 'HIGH',
      pinned: true,
      content: {
        hasGeneratedUi: true,
        relevantFiles: ['src/App.tsx'],
      },
    },
    {
      id: 'recent-conversation',
      source: 'conversation',
      kind: 'CONVERSATION',
      priority: 'NORMAL',
      pinned: false,
      content: 'User asked to keep the existing layout.',
    },
  ]);
});

test('rejects ambiguous provider and section identifiers', async () => {
  const budget = createContextBudget({
    maxContextTokens: 32_000,
    reservedOutputTokens: 4_000,
  });

  assert.throws(
    () => new ContextBuilder({
      budget,
      providers: [
        { id: 'project', provide: () => null },
        { id: ' project ', provide: () => null },
      ],
    }),
    /Duplicate Context provider id: project/,
  );

  const builder = new ContextBuilder({
    budget,
    providers: [
      {
        id: 'one',
        provide: () => ({
          id: 'shared',
          kind: 'TASK',
          priority: 'CRITICAL',
          content: 'one',
        }),
      },
      {
        id: 'two',
        provide: () => ({
          id: 'shared',
          kind: 'PROJECT',
          priority: 'HIGH',
          content: 'two',
        }),
      },
    ],
  });

  await assert.rejects(
    builder.build({ operation: 'EDIT', request: 'Change the card' }),
    /Duplicate Context section id: shared/,
  );
});
