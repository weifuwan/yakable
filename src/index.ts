export {
  BuildIntentGateError,
  classifyBuildIntent,
  detectObviousBuildIntent,
  parseBuildIntentDecision,
} from './prompt-intelligence/build-intent.js';
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
export {
  EDIT_INTENT_VERSION,
  MAX_EDIT_INTENT_DIRECTIVES,
  MAX_EDIT_INTENT_PRESERVE,
  MAX_EDIT_INTENT_PROMPT_LENGTH,
  MAX_EDIT_INTENT_TARGET_HINTS,
  buildEditIntentDeltaRequest,
  fallbackEditIntentDelta,
  parseEditIntentDelta,
  resolveEditIntentDelta,
} from './editing/edit-intent.js';
export type {
  EditIntentArea,
  EditIntentDelta,
  EditIntentDeltaInput,
  EditIntentDirective,
  EditIntentDirectiveBasis,
  EditIntentResolution,
  EditIntentResolutionSource,
  EditIntentScope,
} from './editing/edit-intent.js';
export {
  DESIGN_CRITIC_MAX_EVIDENCE_REFS,
  DESIGN_CRITIC_MAX_FINDINGS,
  DESIGN_CRITIC_MAX_REQUEST_CHARS,
  DESIGN_CRITIC_MAX_UNVERIFIED_AREAS,
  DESIGN_CRITIC_VERSION,
  buildDesignCriticRequest,
  critiqueDesign,
  mergeDeterministicRuntimeFindings,
  parseDesignCriticResult,
} from './editing/design-critic.js';
export type {
  DesignCriticArea,
  DesignCriticFinding,
  DesignCriticInput,
  DesignCriticResult,
  DesignCriticRun,
  DesignCriticSeverity,
  DesignCriticStatus,
} from './editing/design-critic.js';
export {
  MAX_VISUAL_REPAIR_CONTEXT_FILES,
  MAX_VISUAL_REPAIR_REQUEST_CHARS,
  assertVisualRepairPatchUsesContext,
  buildVisualRepairRequest,
  repairGeneratedProjectVisual,
  runVisualRepairOnce,
  selectVisualRepairContextFiles,
} from './editing/visual-repair.js';
export type {
  RunVisualRepairInput,
  VisualRepairGeneration,
  VisualRepairProjectInput,
  VisualRepairResult,
  VisualRepairStatus,
} from './editing/visual-repair.js';
export {
  MAX_CONTEXT_SEARCH_QUERY_LENGTH,
  MAX_EDIT_CONTEXT_FILES,
  MAX_PROJECT_CONTEXT_CANDIDATES,
  buildProjectContextSelectionRequest,
  fallbackEditContextFiles,
  parseProjectContextSelection,
  selectMappedVisualContextFiles,
  selectProjectContextFiles,
} from './editing/context-selection.js';
export type {
  EditContextSelection,
  EditContextSelectionInput,
  EditContextSelectionSource,
} from './editing/context-selection.js';
export {
  rankProjectSearchFiles,
  resolveProjectContextSearch,
} from './editing/context-search.js';
export {
  MAX_REPAIR_CONTEXT_FILES,
  assertRepairPatchUsesContext,
  buildOneShotRepairRequest,
  runOneShotRepair,
  selectOneShotRepairContextFiles,
} from './editing/repair.js';
export type {
  OneShotRepairResult,
  OneShotRepairStatus,
  RepairGeneration,
  RunOneShotRepairInput,
} from './editing/repair.js';
export {
  CHECK_PROJECT_MAX_DIAGNOSTICS,
  CHECK_PROJECT_MAX_OUTPUT_BYTES,
  CHECK_PROJECT_TIMEOUT_MS,
  checkProjectDirectory,
  checkProjectTool,
  defaultProjectCheckRunner,
  parseProjectCheckDiagnostics,
} from './tools/check-project.js';
export type {
  CheckProjectOutput,
  ProjectCheckCommandResult,
  ProjectCheckDiagnostic,
  ProjectCheckPhase,
  ProjectCheckRunner,
  ProjectCheckStatus,
  ProjectCheckStep,
} from './tools/check-project.js';
export {
  READ_PROJECT_FILE_MAX_BYTES,
  readProjectFileTool,
} from './tools/read-project-file.js';
export type {
  ReadProjectFileInput,
  ReadProjectFileOutput,
} from './tools/read-project-file.js';
export {
  SEARCH_PROJECT_MAX_FILES,
  SEARCH_PROJECT_MAX_QUERY_LENGTH,
  SEARCH_PROJECT_MAX_RESULTS,
  searchProjectTool,
} from './tools/search-project.js';
export type {
  SearchProjectInput,
  SearchProjectMatch,
  SearchProjectOutput,
} from './tools/search-project.js';
export { ToolRegistry } from './tools/tool.js';
export type {
  RegisteredTool,
  Tool,
  ToolContext,
  ToolError,
  ToolResult,
} from './tools/tool.js';
export {
  PAGE_OBSERVATION_MAX_ELEMENTS,
  PAGE_OBSERVATION_MAX_ERROR_LENGTH,
  PAGE_OBSERVATION_MAX_RUNTIME_ERRORS,
  PAGE_OBSERVATION_MAX_SELECTOR_LENGTH,
  PAGE_OBSERVATION_MAX_TEXT_LENGTH,
  PAGE_OBSERVATION_VERSION,
  parsePageObservation,
} from './runtime/page-observation.js';
export type {
  PageObservation,
  PageObservationElement,
  PageObservationRect,
  PageObservationRuntimeError,
  PageObservationRuntimeErrorKind,
  PageObservationSource,
} from './runtime/page-observation.js';
export type {
  BuildIntentConfidence,
  BuildIntentDecision,
  BuildIntentRoute,
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
