import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTemplateGenerationRequest, selectProjectTemplate } from '../src/template.js';
import type { PromptIntent } from '../src/types.js';

const dashboardIntent: PromptIntent = {
  version: 1,
  productType: 'analytics product',
  pageType: 'dashboard',
  primaryGoal: 'operate analytics workflows',
  targetAudience: null,
  styleKeywords: ['简洁'],
  explicitRequirements: [],
  hardConstraints: [],
  missingInformation: [],
};

test('selects website for presentation-first prompts', () => {
  assert.equal(selectProjectTemplate('Build a SaaS landing page with hero and pricing'), 'website');
});

test('selects app for multi-screen product prompts', () => {
  assert.equal(selectProjectTemplate('做一个 CRM 管理系统，有客户、订单和设置页面'), 'app');
  assert.equal(selectProjectTemplate('Build an account dashboard with login and settings'), 'app');
});

test('uses structured intent before falling back to prompt heuristics', () => {
  assert.equal(selectProjectTemplate('做一个数据分析产品', dashboardIntent), 'app');
});

test('builds a structured generation request with prompt intent and fixed template guidance', () => {
  const request = JSON.parse(
    buildTemplateGenerationRequest('Build an analytics product', 'app', dashboardIntent),
  ) as {
    productRequest: string;
    promptIntent: PromptIntent;
    projectTemplate: string;
    templateGuidance: { preferredStructure: string[] };
  };

  assert.equal(request.productRequest, 'Build an analytics product');
  assert.equal(request.promptIntent.pageType, 'dashboard');
  assert.equal(request.projectTemplate, 'app');
  assert.ok(request.templateGuidance.preferredStructure.includes('src/routes.ts'));
});
