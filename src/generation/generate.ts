import { requestProjectCode } from '../model/deepseek.js';
import { buildDesignIntent } from '../prompt-intelligence/design-intent.js';
import { analyzePromptIntent } from '../prompt-intelligence/intent.js';
import { expandPromptSemantics } from '../prompt-intelligence/semantic.js';
import { translatePromptTaste } from '../prompt-intelligence/taste.js';
import { parseGeneratedProject, writeGeneratedProject } from '../projects/project.js';
import type { GenerationResult } from '../types.js';
import { buildTemplateGenerationRequest, selectProjectTemplate } from './template.js';

export async function generateProject(prompt: string): Promise<GenerationResult> {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    throw new Error('A product prompt is required.');
  }

  if (normalizedPrompt.length > 12_000) {
    throw new Error('Prompt is too long. Project generation accepts at most 12,000 characters.');
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
  const project = parseGeneratedProject(generation.content);
  project.template = template;
  const outputDirectory = await writeGeneratedProject(normalizedPrompt, project);

  return {
    project,
    outputDirectory,
    model: generation.model,
    intent,
    semanticExpansion,
    tasteTranslation,
    designIntent,
  };
}
