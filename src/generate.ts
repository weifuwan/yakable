import { requestProjectCode } from './deepseek.js';
import { analyzePromptIntent } from './intent.js';
import { parseGeneratedProject, writeGeneratedProject } from './project.js';
import { expandPromptSemantics } from './semantic.js';
import { translatePromptTaste } from './taste.js';
import { buildTemplateGenerationRequest, selectProjectTemplate } from './template.js';
import type { GenerationResult } from './types.js';

export async function generateProject(prompt: string): Promise<GenerationResult> {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    throw new Error('A product prompt is required.');
  }

  if (normalizedPrompt.length > 12_000) {
    throw new Error('Prompt is too long. Stage 1 accepts at most 12,000 characters.');
  }

  const intent = await analyzePromptIntent(normalizedPrompt);
  const semanticExpansion = await expandPromptSemantics(normalizedPrompt, intent);
  const tasteTranslation = await translatePromptTaste(
    normalizedPrompt,
    intent,
    semanticExpansion,
  );
  const template = selectProjectTemplate(normalizedPrompt, intent);
  const generation = await requestProjectCode(
    buildTemplateGenerationRequest(
      normalizedPrompt,
      template,
      intent,
      semanticExpansion,
      tasteTranslation,
    ),
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
  };
}
