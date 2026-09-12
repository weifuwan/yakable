import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTemplateGenerationRequest, selectProjectTemplate } from '../src/template.js';

test('selects website for presentation-first prompts', () => {
  assert.equal(selectProjectTemplate('Build a SaaS landing page with hero and pricing'), 'website');
});

test('selects app for multi-screen product prompts', () => {
  assert.equal(selectProjectTemplate('做一个 CRM 管理系统，有客户、订单和设置页面'), 'app');
  assert.equal(selectProjectTemplate('Build an account dashboard with login and settings'), 'app');
});

test('builds a structured generation request with fixed template guidance', () => {
  const request = JSON.parse(buildTemplateGenerationRequest('Build a CRM', 'app')) as {
    productRequest: string;
    projectTemplate: string;
    templateGuidance: { preferredStructure: string[] };
  };

  assert.equal(request.productRequest, 'Build a CRM');
  assert.equal(request.projectTemplate, 'app');
  assert.ok(request.templateGuidance.preferredStructure.includes('src/routes.ts'));
});
