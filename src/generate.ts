import { requestProjectCode } from './deepseek.js';
import { parseGeneratedProject, writeGeneratedProject } from './project.js';
import type { GenerationResult } from './types.js';

export async function generateProject(prompt: string): Promise<GenerationResult> {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    throw new Error('A product prompt is required.');
  }

  if (normalizedPrompt.length > 12_000) {
    throw new Error('Prompt is too long. Stage 1 accepts at most 12,000 characters.');
  }

  const generation = await requestProjectCode(normalizedPrompt);
  const project = parseGeneratedProject(generation.content);
  const outputDirectory = await writeGeneratedProject(normalizedPrompt, project);

  return {
    project,
    outputDirectory,
    model: generation.model,
  };
}
