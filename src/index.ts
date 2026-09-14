export { buildDesignIntent } from './prompt-intelligence/design-intent.js';
export { generateProject } from './generation/generate.js';
export { analyzePromptIntent, parsePromptIntent } from './prompt-intelligence/intent.js';
export {
  parseGeneratedProject,
  slugifyPrompt,
  writeGeneratedProject,
} from './projects/project.js';
export {
  BASE_TEMPLATE_ID,
  BASE_TEMPLATE_VERSION,
  createBaseProject,
  readBaseTemplateManifest,
} from './templates/base-template.js';
export type {
  BaseTemplateManifest,
  CreateBaseProjectOptions,
  CreatedBaseProject,
} from './templates/base-template.js';
export {
  CAPABILITY_PACK_VERSION,
  PROJECT_CAPABILITY_STATE_VERSION,
  installCapabilityPacks,
  listCapabilityPacks,
  readCapabilityPackManifest,
  readProjectCapabilityState,
} from './templates/capability-pack.js';
export type {
  CapabilityDependencyChange,
  CapabilityPackManifest,
  InstallCapabilityPacksOptions,
  InstallCapabilityPacksResult,
  InstalledCapabilityPack,
  ProjectCapabilityState,
} from './templates/capability-pack.js';
export {
  buildSemanticExpansionRequest,
  expandPromptSemantics,
  parseSemanticExpansion,
} from './prompt-intelligence/semantic.js';
export {
  buildTasteTranslationRequest,
  parseTasteTranslation,
  translatePromptTaste,
} from './prompt-intelligence/taste.js';
export type {
  DesignIntentDirective,
  DesignIntentIR,
  DesignIntentOpenQuestion,
  DesignIntentOpenQuestionSource,
  DesignIntentProduct,
  DesignIntentRequirement,
  DesignIntentRequirementConfidence,
  DesignIntentRequirementKind,
  DesignIntentRequirementSource,
  GeneratedFile,
  GeneratedProject,
  GenerationResult,
  ProjectConversation,
  ProjectConversationMessage,
  ProjectEditHistoryItem,
  ProjectSessionState,
  ProjectVisualSelection,
  PromptIntent,
  SemanticConfidence,
  SemanticDefault,
  SemanticDefaultBasis,
  SemanticDefaultKind,
  SemanticExpansion,
  TasteDecision,
  TasteDecisionArea,
  TasteDecisionBasis,
  TasteIntensity,
  TasteTranslation,
} from './types.js';
