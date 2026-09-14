import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTemplateGenerationRequest,
  selectProjectTemplate,
} from '../src/generation/template.js';
import type { DesignIntentIR } from '../src/types.js';

const dashboardDesignIntent: DesignIntentIR = {
  version: 1,
  product: {
    type: 'analytics product',
    surface: 'dashboard',
    primaryGoal: 'operate analytics workflows',
    targetAudience: null,
  },
  designDirection: 'Calm, precise and low-noise analytics workspace',
  styleSignals: ['简洁'],
  requirements: [
    {
      statement: 'Make the primary analytics workflow obvious from the first screen',
      source: 'semantic-default',
      kind: 'behavior',
      confidence: 'high',
      basis: 'goal-pattern',
    },
  ],
  directives: [
    {
      area: 'visual-hierarchy',
      directive: 'Make the primary analytical task dominant and keep secondary controls visually quiet',
      basis: 'style-keyword',
      intensity: 'strong',
      sourceKeywords: ['简洁'],
    },
  ],
  antiPatterns: ['uniformly emphasizing every dashboard surface'],
  openQuestions: [
    { value: 'Whether authentication is required', source: 'semantic-decision' },
  ],
};

test('selects website for presentation-first prompts', () => {
  assert.equal(selectProjectTemplate('Build a SaaS landing page with hero and pricing'), 'website');
});

test('selects app for multi-screen product prompts', () => {
  assert.equal(selectProjectTemplate('做一个 CRM 管理系统，有客户、订单和设置页面'), 'app');
  assert.equal(selectProjectTemplate('Build an account dashboard with login and settings'), 'app');
});

test('uses design intent IR before falling back to prompt heuristics', () => {
  assert.equal(selectProjectTemplate('做一个数据分析产品', dashboardDesignIntent), 'app');
});

test('builds generation request around Design Intent and Yakable Base contracts', () => {
  const request = JSON.parse(
    buildTemplateGenerationRequest(
      'Build an analytics product',
      'app',
      dashboardDesignIntent,
    ),
  ) as {
    productRequest: string;
    designIntent: DesignIntentIR;
    projectTemplate: string;
    baseTemplate: {
      id: string;
      stack: string;
      projectOwnedPaths: string[];
    };
    templateGuidance: { preferredStructure: string[] };
    promptIntent?: unknown;
    semanticExpansion?: unknown;
    tasteTranslation?: unknown;
  };

  assert.equal(request.productRequest, 'Build an analytics product');
  assert.equal(request.designIntent.product.surface, 'dashboard');
  assert.equal(request.designIntent.requirements[0]?.kind, 'behavior');
  assert.equal(request.designIntent.directives[0]?.area, 'visual-hierarchy');
  assert.equal(request.designIntent.openQuestions[0]?.source, 'semantic-decision');
  assert.equal(request.projectTemplate, 'app');
  assert.equal(request.baseTemplate.id, 'base');
  assert.match(request.baseTemplate.stack, /Tailwind CSS v4/);
  assert.ok(request.baseTemplate.projectOwnedPaths.includes('src/pages/**'));
  assert.ok(request.baseTemplate.projectOwnedPaths.includes('src/components/product/**'));
  assert.ok(request.templateGuidance.preferredStructure.includes('src/pages/'));
  assert.ok(request.templateGuidance.preferredStructure.includes('src/routes.ts'));
  assert.equal(request.promptIntent, undefined);
  assert.equal(request.semanticExpansion, undefined);
  assert.equal(request.tasteTranslation, undefined);
});
