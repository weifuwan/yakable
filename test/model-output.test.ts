import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProjectGenerationRecoveryRequest } from '../src/generation/generate.js';
import {
  ModelOutputFormatError,
  normalizeModelJsonObject,
} from '../src/generation/model-output.js';

const valid = JSON.stringify({
  summary: 'demo',
  template: 'app',
  routes: [{ path: '/', title: 'Home' }],
  files: [
    { path: 'src/App.tsx', content: 'export default function App() { return null; }' },
    { path: 'src/routes.ts', content: 'export const routes = [];' },
    { path: 'src/pages/HomePage.tsx', content: 'export function HomePage() { return null; }' },
  ],
});

test('accepts a direct JSON object from the model', () => {
  assert.equal(normalizeModelJsonObject(valid), valid);
});

test('recovers JSON wrapped in Markdown fences', () => {
  assert.equal(normalizeModelJsonObject(`\n\`\`\`json\n${valid}\n\`\`\`\n`), valid);
});

test('recovers a complete JSON object surrounded by model prose', () => {
  assert.equal(
    normalizeModelJsonObject(`Here is the project you requested:\n${valid}\nDone.`),
    valid,
  );
});

test('rejects truncated model JSON instead of passing a partial project downstream', () => {
  assert.throws(
    () => normalizeModelJsonObject('{"summary":"demo","files":['),
    ModelOutputFormatError,
  );
});

test('builds one bounded recovery request after a validation failure', () => {
  const original = JSON.stringify({
    productRequest: '帮我做一个数据同步的项目',
    projectTemplate: 'app',
    baseTemplate: { id: 'base' },
  });
  const recovery = JSON.parse(
    buildProjectGenerationRecoveryRequest(
      original,
      new Error('Model output was not valid JSON.'),
    ),
  ) as {
    productRequest: string;
    generationRecovery: {
      attempt: number;
      previousFailure: string;
      instructions: string[];
    };
  };

  assert.equal(recovery.productRequest, '帮我做一个数据同步的项目');
  assert.equal(recovery.generationRecovery.attempt, 2);
  assert.match(recovery.generationRecovery.previousFailure, /not valid JSON/);
  assert.ok(
    recovery.generationRecovery.instructions.some((instruction) =>
      instruction.includes('never exceed 12 files'),
    ),
  );
});
