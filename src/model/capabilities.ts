import { DESIGN_CRITIC_SYSTEM_PROMPT } from '../editing/design-critic-prompt.js';
import { EDIT_INTENT_DELTA_SYSTEM_PROMPT } from '../editing/edit-intent-prompt.js';
import { PROJECT_CONTEXT_SELECTION_SYSTEM_PROMPT } from '../editing/context-selection-prompt.js';
import { PROJECT_EDIT_SYSTEM_PROMPT } from '../editing/edit-prompt.js';
import { PROJECT_REPAIR_SYSTEM_PROMPT } from '../editing/repair-prompt.js';
import { VISUAL_REPAIR_SYSTEM_PROMPT } from '../editing/visual-repair-prompt.js';
import { PROJECT_GENERATION_SYSTEM_PROMPT } from '../generation/prompt.js';
import { PLAN_ARTIFACT_SYSTEM_PROMPT } from '../planning/plan-artifact-prompt.js';
import { UI_PLANNER_SYSTEM_PROMPT } from '../planning/ui-planner-prompt.js';
import { BUILD_INTENT_SYSTEM_PROMPT } from '../prompt-intelligence/build-intent-prompt.js';
import { INTENT_ANALYSIS_SYSTEM_PROMPT } from '../prompt-intelligence/intent-prompt.js';
import { PROJECT_MESSAGE_INTENT_SYSTEM_PROMPT } from '../prompt-intelligence/project-message-prompt.js';
import { SEMANTIC_EXPANSION_SYSTEM_PROMPT } from '../prompt-intelligence/semantic-prompt.js';
import { TASTE_TRANSLATION_SYSTEM_PROMPT } from '../prompt-intelligence/taste-prompt.js';
import type { ModelClient, ModelGeneration } from './model-client.js';

function structured(
  modelClient: ModelClient,
  systemPrompt: string,
  userPrompt: string,
  capabilityLabel: string,
  maxTokens?: number,
): Promise<ModelGeneration> {
  return modelClient.generateStructured({
    systemPrompt,
    userPrompt,
    capabilityLabel,
    ...(maxTokens ? { maxTokens } : {}),
  });
}

export function requestBuildIntent(modelClient: ModelClient, userPrompt: string) {
  return structured(modelClient, BUILD_INTENT_SYSTEM_PROMPT, userPrompt, 'Build Intent Gate', 2_048);
}

export function requestPromptIntent(modelClient: ModelClient, userPrompt: string) {
  return structured(modelClient, INTENT_ANALYSIS_SYSTEM_PROMPT, userPrompt, 'Prompt Intelligence Intent Parser');
}

export function requestSemanticExpansion(modelClient: ModelClient, userPrompt: string) {
  return structured(modelClient, SEMANTIC_EXPANSION_SYSTEM_PROMPT, userPrompt, 'Prompt Intelligence Semantic Expander');
}

export function requestTasteTranslation(modelClient: ModelClient, userPrompt: string) {
  return structured(modelClient, TASTE_TRANSLATION_SYSTEM_PROMPT, userPrompt, 'Prompt Intelligence Taste Translator');
}

export function requestProjectCode(modelClient: ModelClient, userPrompt: string) {
  return structured(modelClient, PROJECT_GENERATION_SYSTEM_PROMPT, userPrompt, 'Project Generation');
}

export function requestPlanArtifact(modelClient: ModelClient, userPrompt: string) {
  return structured(modelClient, PLAN_ARTIFACT_SYSTEM_PROMPT, userPrompt, 'Plan Artifact');
}

export function requestUiPlan(modelClient: ModelClient, userPrompt: string) {
  return structured(modelClient, UI_PLANNER_SYSTEM_PROMPT, userPrompt, 'UI Planner');
}

export function requestEditIntentDelta(modelClient: ModelClient, userPrompt: string) {
  return structured(modelClient, EDIT_INTENT_DELTA_SYSTEM_PROMPT, userPrompt, 'Edit Intent Delta');
}

export function requestDesignCritique(modelClient: ModelClient, userPrompt: string) {
  return structured(modelClient, DESIGN_CRITIC_SYSTEM_PROMPT, userPrompt, 'Design Critic');
}

export function requestProjectContextSelection(modelClient: ModelClient, userPrompt: string) {
  return structured(modelClient, PROJECT_CONTEXT_SELECTION_SYSTEM_PROMPT, userPrompt, 'Project Context Selection');
}

export function requestProjectPatch(modelClient: ModelClient, userPrompt: string) {
  return structured(modelClient, PROJECT_EDIT_SYSTEM_PROMPT, userPrompt, 'Project Edit');
}

export function requestProjectRepair(modelClient: ModelClient, userPrompt: string) {
  return structured(modelClient, PROJECT_REPAIR_SYSTEM_PROMPT, userPrompt, 'One-shot Project Repair');
}

export function requestVisualRepair(modelClient: ModelClient, userPrompt: string) {
  return structured(modelClient, VISUAL_REPAIR_SYSTEM_PROMPT, userPrompt, 'Visual Repair');
}

export function requestProjectMessageDecision(modelClient: ModelClient, userPrompt: string) {
  return structured(
    modelClient,
    PROJECT_MESSAGE_INTENT_SYSTEM_PROMPT,
    userPrompt,
    'Project Message Router',
    2_048,
  );
}
