import { requestProjectCode } from '../model/deepseek.js';
import {
  BuildIntentGateError,
  classifyBuildIntent,
} from '../prompt-intelligence/build-intent.js';
import { buildDesignIntent } from '../prompt-intelligence/design-intent.js';
import { analyzePromptIntent } from '../prompt-intelligence/intent.js';
import { expandPromptSemantics } from '../prompt-intelligence/semantic.js';
import { translatePromptTaste } from '../prompt-intelligence/taste.js';
import {
  parseGeneratedProject,
  writeGeneratedProjectFromBase,
} from '../projects/project.js';
import { initializeProjectSession } from '../projects/project-session.js';
import type { BuildIntentDecision, GenerationResult } from '../types.js';
import { buildTemplateGenerationRequest, selectProjectTemplate } from './template.js';

export interface GenerateProjectOptions {
  buildIntent?: BuildIntentDecision;
}

export async function generateProject(
  prompt: string,
  options: GenerateProjectOptions = {},
): Promise<GenerationResult> {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    throw new Error('A product prompt is required.');
  }

  if (normalizedPrompt.length > 12_000) {
    throw new Error('Prompt is too long. Project generation accepts at most 12,000 characters.');
  }

  const buildIntent = options.buildIntent ?? await classifyBuildIntent(normalizedPrompt);
  if (buildIntent.route !== 'CREATE') {
    throw new BuildIntentGateError(buildIntent);
  }

  const intent = await analyzePromptIntent(normalizedPrompt);
  const semanticExpansion = await expandPromptSemantics(normalizedPrompt, intent);
  const tasteTranslation = await translatePromptTaste(
    normalizedPrompt,
    intent,
    semanticExpansion,
  );
  const designIntent = buildDesignIntent(intent, semanticExpansion, tasteTranslation);
  const template = selectProjectTemplate(normalizedPrompt, designIntent);
  const generation = await requestProjectCode(
    buildTemplateGenerationRequest(normalizedPrompt, template, designIntent),
  );
  const project = parseGeneratedProject(generation.content, {
    mode: 'base-overlay',
    expectedTemplate: template,
  });
  const outputDirectory = await writeGeneratedProjectFromBase(normalizedPrompt, project);
  await initializeProjectSession(outputDirectory, {
    productRequest: normalizedPrompt,
    designIntent,
    initialSummary: project.summary,
  });

  return {
    project,
    outputDirectory,
    model: generation.model,
    buildIntent,
    intent,
    semanticExpansion,
    tasteTranslation,
    designIntent,
  };
}
