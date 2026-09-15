export {
  assertWithinContextBudget,
  createContextBudget,
  measureContextBudget,
} from './context-budget.js';
export type {
  ContextBudget,
  ContextBudgetInput,
  ContextBudgetUsage,
} from './context-budget.js';

export {
  CONTEXT_OPERATIONS,
  CONTEXT_PRIORITIES,
  CONTEXT_SECTION_KINDS,
  CONTEXT_SNAPSHOT_VERSION,
} from './context-contract.js';
export type {
  ContextBuildRequest,
  ContextContribution,
  ContextJsonObject,
  ContextJsonPrimitive,
  ContextJsonValue,
  ContextOperation,
  ContextPriority,
  ContextSection,
  ContextSectionKind,
  ContextSnapshot,
} from './context-contract.js';

export { ContextBuilder } from './context-builder.js';
export type {
  ContextBuilderOptions,
  ContextProvider,
  ContextProviderResult,
} from './context-builder.js';

export {
  CONVERSATION_CONTEXT_BUDGET,
  CONVERSATION_CONTEXT_COMPACTED_MAX_TOKENS,
  CONVERSATION_CONTEXT_COMPACTED_MESSAGE_CHARS,
  CONVERSATION_CONTEXT_COMPACTED_MESSAGE_MAX_TOKENS,
  CONVERSATION_CONTEXT_HISTORY_MAX_TOKENS,
  CONVERSATION_CONTEXT_MAX_MESSAGE_CHARS,
  CONVERSATION_CONTEXT_MAX_MESSAGES,
  CONVERSATION_CONTEXT_MESSAGE_OVERHEAD_TOKENS,
  CONVERSATION_CONTEXT_NON_HISTORY_RESERVE_TOKENS,
  CONVERSATION_CONTEXT_RECENT_MAX_TOKENS,
  CONVERSATION_CONTEXT_VERSION,
  buildConversationContext,
} from './conversation-context.js';
export type {
  ConversationContext,
  ConversationContextMessage,
} from './conversation-context.js';

export {
  CONTEXT_TOKEN_ESTIMATOR_VERSION,
  estimateTextTokens,
  truncateTextToEstimatedTokens,
} from './token-estimator.js';
export type { TruncatedTextResult } from './token-estimator.js';

export {
  MAX_CONTEXT_SEARCH_QUERY_LENGTH,
  MAX_EDIT_CONTEXT_FILES,
  MAX_PROJECT_CONTEXT_CANDIDATES,
  buildProjectContextSelectionRequest,
  fallbackEditContextFiles,
  parseProjectContextSelection,
  selectMappedVisualContextFiles,
  selectProjectContextFiles,
} from './project-context-selection.js';
export type {
  EditContextSelection,
  EditContextSelectionInput,
  EditContextSelectionSource,
} from './project-context-selection.js';

export {
  rankProjectSearchFiles,
  resolveProjectContextSearch,
} from './project-context-search.js';

export {
  buildProjectContinuityContext,
  buildProjectEditContext,
  extractUserEditContext,
  extractUserEditRequest,
  listProjectContextFiles,
  readProjectSnapshot,
  resolveProjectEditContext,
} from './project-context.js';
export type {
  ProjectContinuityContext,
  ProjectSnapshot,
  ResolvedProjectEditContext,
  ResolveProjectEditContextInput,
  UserEditContext,
} from './project-context.js';
