import path from 'node:path';

import {
  applyProjectChanges,
  createProjectChangeManager,
  parseProjectPatch,
} from '../editing/project-change.js';
import {
  listProjectContextFiles,
  readProjectSnapshot,
} from '../editing/project-context.js';
import {
  createFrontendAgentRecorder,
  runFrontendAgentStage,
  type FrontendAgentProgressOptions,
} from '../editing/frontend-agent.js';
import { runOneShotRepair } from '../editing/repair.js';
import { requestProjectCode, requestProjectRepair } from '../model/deepseek.js';
import { assertModeCapability, type YakableMode } from '../modes/mode-contract.js';
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
import {
  appendAgentRunEvent,
  createAgentRun,
} from '../storage/agent-run.js';
import { recordAgentRunChangeSet } from '../storage/agent-run-change-set.js';
import { checkProjectTool } from '../tools/check-project.js';
import type {
  BuildIntentDecision,
  GeneratedProject,
  GenerationResult,
  ProjectTemplate,
} from '../types.js';
import { workspaceChangedPaths } from '../workspace/change-set.js';
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

export interface GenerateProjectOptions extends FrontendAgentProgressOptions {
  buildIntent?: BuildIntentDecision;
  mode?: YakableMode;
  verifyProject?: boolean;
  persistAgentRun?: boolean;
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

  const mode = options.mode ?? 'BUILD';
  assertModeCapability(mode, 'generate-source');

  let agentRunId: string | undefined;
  const agent = createFrontendAgentRecorder({
    onEvent(event) {
      if (agentRunId) {
        try {
          appendAgentRunEvent(agentRunId, event);
        } catch (error) {
          console.warn('[Yakable Agent] Create event could not be persisted.', error);
        }
      }
      options.onEvent?.(event);
    },
  });

  const buildIntent = await runFrontendAgentStage(
    agent,
    'ROUTE',
    'Classifying the request for Build mode',
    (decision) => `Routed the request to ${decision.route} with ${decision.confidence} confidence`,
    async () => options.buildIntent ?? classifyBuildIntent(normalizedPrompt),
  );
  if (buildIntent.route !== 'CREATE') {
    throw new BuildIntentGateError(buildIntent);
  }

  const intent = await runFrontendAgentStage(
    agent,
    'UNDERSTAND',
    'Understanding the requested product and page structure',
    (result) => `Understood ${result.productType} as a ${result.pageType} experience`,
    () => analyzePromptIntent(normalizedPrompt),
  );

  const semanticExpansion = await runFrontendAgentStage(
    agent,
    'UNDERSTAND',
    'Expanding conservative product defaults from the request',
    (result) => `Resolved ${result.defaults.length} product default(s) and ${result.assumptions.length} assumption(s)`,
    () => expandPromptSemantics(normalizedPrompt, intent),
  );

  const design = await runFrontendAgentStage(
    agent,
    'DESIGN',
    'Translating the request into an executable design direction',
    (result) => `Design direction ready: ${result.tasteTranslation.designDirection}`,
    async () => {
      const tasteTranslation = await translatePromptTaste(
        normalizedPrompt,
        intent,
        semanticExpansion,
      );
      const designIntent = buildDesignIntent(intent, semanticExpansion, tasteTranslation);
      return { tasteTranslation, designIntent };
    },
  );
  const { tasteTranslation, designIntent } = design;

  const template = await runFrontendAgentStage(
    agent,
    'TEMPLATE',
    'Selecting the Yakable project template',
    (selected) => `Selected the ${selected} template`,
    async () => selectProjectTemplate(normalizedPrompt, designIntent),
  );
  const generationRequest = buildTemplateGenerationRequest(
    normalizedPrompt,
    template,
    designIntent,
  );

  const generated = await runFrontendAgentStage(
    agent,
    'GENERATE',
    'Generating the project-owned frontend layer',
    (result) => `Generated ${result.project.files.length} project-owned file(s)`,
    async () => {
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

      return { generation, project };
    },
  );
  const { generation, project } = generated;

  const written = await runFrontendAgentStage(
    agent,
    'WRITE',
    'Applying the generated product layer to Yakable Base',
    'Created the project from Yakable Base and applied the generated overlay',
    () => writeGeneratedProjectFromBase(normalizedPrompt, project),
  );
  const { outputDirectory, changeSet: initialChangeSet } = written;

  await initializeProjectSession(outputDirectory, {
    productRequest: normalizedPrompt,
    designIntent,
    initialSummary: project.summary,
  });

  if (options.persistAgentRun) {
    const run = createAgentRun({
      projectId: path.basename(outputDirectory),
      kind: 'CREATE',
      prompt: normalizedPrompt,
    });
    agentRunId = run.id;
    for (const event of agent.snapshot()) {
      appendAgentRunEvent(run.id, event);
    }
    try {
      recordAgentRunChangeSet(run.id, initialChangeSet);
    } catch (error) {
      console.warn('[Yakable Agent] Initial create change set could not be persisted.', error);
    }
  }

  if (options.verifyProject) {
    const resolvedProject = {
      id: path.basename(outputDirectory),
      directory: outputDirectory,
    };
    const changeManager = createProjectChangeManager(resolvedProject);
    agent.emit('CHECK', 'ACTIVE', 'Checking TypeScript and production build health');
    const initialCheck = await checkProjectTool.execute(
      {},
      { projectDirectory: outputDirectory },
    );

    if (initialCheck.ok && initialCheck.value.status === 'PASS') {
      agent.emit('CHECK', 'COMPLETED', 'TypeScript and production build checks passed');
    } else if (!initialCheck.ok) {
      agent.emit(
        'CHECK',
        'FAILED',
        `Project health check could not run: ${initialCheck.error.message}`,
      );
    } else {
      agent.emit('REPAIR', 'ACTIVE', 'Applying one bounded build repair');
      const availableFiles = await listProjectContextFiles(outputDirectory);
      const initialChangedFiles = workspaceChangedPaths(initialChangeSet);
      const repair = await runOneShotRepair({
        projectId: resolvedProject.id,
        userRequest: normalizedPrompt,
        initialEditSummary: project.summary,
        initialChangedFiles,
        selectedContextFiles: initialChangedFiles,
        availableFiles,
        initialCheck,
        readFiles: async (paths) => (await readProjectSnapshot(resolvedProject, paths)).files,
        requestRepair: requestProjectRepair,
        parsePatch: parseProjectPatch,
        applyChanges: async (patch) => {
          const changeSet = await applyProjectChanges(changeManager, patch);
          if (agentRunId) {
            try {
              recordAgentRunChangeSet(agentRunId, changeSet);
            } catch (error) {
              console.warn('[Yakable Agent] Create repair change set could not be persisted.', error);
            }
          }
          return changeSet;
        },
        checkProject: () =>
          checkProjectTool.execute({}, { projectDirectory: outputDirectory }),
      });

      if (repair.status === 'REPAIRED') {
        agent.emit('REPAIR', 'COMPLETED', 'Applied one code-healthy build repair');
      } else {
        agent.emit(
          'REPAIR',
          'FAILED',
          repair.error || 'The bounded build repair did not produce a healthy project',
        );
      }

      if (repair.finalCheck.ok && repair.finalCheck.value.status === 'PASS') {
        agent.emit('CHECK', 'COMPLETED', 'Project is code-healthy after the bounded repair');
      } else {
        agent.emit(
          'CHECK',
          'FAILED',
          repair.finalCheck.ok
            ? 'Project health check still reports source errors after repair'
            : `Project health check could not complete after repair: ${repair.finalCheck.error.message}`,
        );
      }
    }
  }

  return {
    project,
    outputDirectory,
    model: generation.model,
    buildIntent,
    intent,
    semanticExpansion,
    tasteTranslation,
    designIntent,
    ...(agentRunId ? { agentRunId } : {}),
  };
}
