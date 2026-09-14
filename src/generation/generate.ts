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
import type {
  BuildIntentDecision,
  GeneratedProject,
  GenerationResult,
  ProjectTemplate,
} from '../types.js';
import { normalizeModelJsonObject } from './model-output.js';
import { buildTemplateGenerationRequest, selectProjectTemplate } from './template.js';

const PROJECT_GENERATION_MAX_ATTEMPTS = 2;

export class ProjectGenerationError extends Error {
  readonly code = 'PROJECT_GENERATION_FAILED';
  readonly retryable = true;
  readonly attempts: number;

  constructor(message: string, attempts: number, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ProjectGenerationError';
    this.attempts = attempts;
  }
}

export interface GenerateProjectOptions {
  buildIntent?: BuildIntentDecision;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown generated-project validation failure.';
}

function parseProjectGeneration(content: string, template: ProjectTemplate): GeneratedProject {
  return parseGeneratedProject(normalizeModelJsonObject(content), {
    mode: 'base-overlay',
    expectedTemplate: template,
  });
}

export function buildProjectGenerationRecoveryRequest(
  generationRequest: string,
  failure: unknown,
): string {
  let request: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(generationRequest);
    request =
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? { ...(parsed as Record<string, unknown>) }
        : { originalRequest: generationRequest };
  } catch {
    request = { originalRequest: generationRequest };
  }

  return JSON.stringify(
    {
      ...request,
      generationRecovery: {
        attempt: 2,
        previousFailure: errorMessage(failure).slice(0, 600),
        instructions: [
          'Regenerate the project-owned overlay from scratch instead of explaining the failure.',
          'Return exactly one complete JSON object and nothing else.',
          'Do not wrap the JSON object in Markdown code fences or add prose before or after it.',
          'Keep the first implementation compact: prefer 4-10 project-owned files and never exceed 12 files.',
          'Keep file contents concise enough to finish the response; do not truncate code or JSON strings.',
          'Follow the Yakable Base ownership contract, page placement rules, and Tailwind-only styling rules.',
        ],
      },
    },
    null,
    2,
  );
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
  const generationRequest = buildTemplateGenerationRequest(
    normalizedPrompt,
    template,
    designIntent,
  );

  let generation = await requestProjectCode(generationRequest);
  let project: GeneratedProject;

  try {
    project = parseProjectGeneration(generation.content, template);
  } catch (firstFailure) {
    try {
      generation = await requestProjectCode(
        buildProjectGenerationRecoveryRequest(generationRequest, firstFailure),
      );
      project = parseProjectGeneration(generation.content, template);
    } catch (recoveryFailure) {
      throw new ProjectGenerationError(
        'Yakable could not produce a valid project after one automatic recovery attempt. Please retry the request; the API process remains available.',
        PROJECT_GENERATION_MAX_ATTEMPTS,
        recoveryFailure,
      );
    }
  }

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
