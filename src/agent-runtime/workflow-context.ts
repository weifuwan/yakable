import {
  MAX_EDIT_CONTEXT_FILES,
  fallbackEditContextFiles,
  type EditContextSelection,
} from '../editing/context-selection.js';
import { rankProjectSearchFiles } from '../editing/context-search.js';
import type { ProjectSnapshot } from '../editing/project-context.js';
import type { ModelClient } from '../model/model-client.js';
import type { YakableMode } from '../modes/mode-contract.js';
import type { AgentProtocolRecorder } from '../protocol/agent-recorder.js';
import type { ResolvedGeneratedProject } from '../runtime/runtime.js';
import type { CheckProjectOutput } from '../tools/check-project.js';
import type { ReadProjectFileOutput } from '../tools/read-project-file.js';
import type { SearchProjectOutput } from '../tools/search-project.js';
import type { ToolResult } from '../tools/tool.js';
import type { GeneratedFile } from '../types.js';
import type { ToolRouter } from './tool-router.js';

const MAX_CONTEXT_TOTAL_BYTES = 800_000;

export interface AgentWorkflowContext {
  mode: YakableMode;
  modelClient: ModelClient;
  toolRouter: ToolRouter;
}

export function createAgentWorkflowContext(input: AgentWorkflowContext): AgentWorkflowContext {
  return { ...input };
}

export function executeWorkflowTool<Output>(
  context: AgentWorkflowContext,
  name: string,
  input: unknown,
  projectDirectory: string,
  agent?: AgentProtocolRecorder,
): Promise<ToolResult<Output>> {
  return context.toolRouter.execute<Output>(
    context.mode,
    name,
    input,
    { projectDirectory, ...(agent ? { agent } : {}) },
  );
}

export async function readWorkflowProjectSnapshot(
  context: AgentWorkflowContext,
  project: ResolvedGeneratedProject,
  selectedPaths: string[],
  agent?: AgentProtocolRecorder,
): Promise<ProjectSnapshot> {
  const paths = [...new Set(selectedPaths)];
  if (paths.length === 0 || paths.length > MAX_EDIT_CONTEXT_FILES) {
    throw new Error(
      `Project edit context must contain between 1 and ${MAX_EDIT_CONTEXT_FILES} selected files.`,
    );
  }

  const files: GeneratedFile[] = [];
  for (const relativePath of paths) {
    const result = await executeWorkflowTool<ReadProjectFileOutput>(
      context,
      'read_project_file',
      { path: relativePath },
      project.directory,
      agent,
    );
    if (!result.ok) {
      throw new Error(
        `Could not read selected project context (${relativePath}): ${result.error.message}`,
      );
    }
    files.push({ path: result.value.path, content: result.value.content });
  }

  const totalBytes = files.reduce(
    (sum, file) => sum + Buffer.byteLength(file.content, 'utf8'),
    0,
  );
  if (totalBytes > MAX_CONTEXT_TOTAL_BYTES) {
    throw new Error(
      `Project edit context is too large (${totalBytes} bytes; max ${MAX_CONTEXT_TOTAL_BYTES}).`,
    );
  }

  return { ...project, files };
}

export async function resolveWorkflowContextSearch(
  context: AgentWorkflowContext,
  projectDirectory: string,
  userRequest: string,
  availableFiles: string[],
  selection: EditContextSelection,
  agent?: AgentProtocolRecorder,
): Promise<EditContextSelection> {
  if (!selection.searchQuery) return selection;

  const search = await executeWorkflowTool<SearchProjectOutput>(
    context,
    'search_project',
    {
      query: selection.searchQuery,
      paths: availableFiles,
      maxResults: 20,
    },
    projectDirectory,
    agent,
  );

  if (!search.ok) {
    if (selection.relevantFiles.length > 0) {
      return {
        ...selection,
        reason: `${selection.reason} Search could not run; using the directly selected files: ${search.error.message}`.slice(0, 400),
      };
    }
    return {
      version: 1,
      relevantFiles: fallbackEditContextFiles(userRequest, availableFiles),
      searchQuery: selection.searchQuery,
      reason: `Context search failed and deterministic fallback was used: ${search.error.message}`.slice(0, 400),
      source: 'fallback',
    };
  }

  const searchedFiles = rankProjectSearchFiles(search.value.matches);
  if (searchedFiles.length === 0 && selection.relevantFiles.length > 0) {
    return {
      ...selection,
      reason: `${selection.reason} Search for "${selection.searchQuery}" returned no matches; using the directly selected files.`.slice(0, 400),
    };
  }

  const relevantFiles = [...selection.relevantFiles];
  for (const file of searchedFiles) {
    if (relevantFiles.length >= MAX_EDIT_CONTEXT_FILES) break;
    if (!relevantFiles.includes(file)) relevantFiles.push(file);
  }

  if (relevantFiles.length === 0) {
    return {
      version: 1,
      relevantFiles: fallbackEditContextFiles(userRequest, availableFiles),
      searchQuery: selection.searchQuery,
      reason: `Search for "${selection.searchQuery}" returned no matches; deterministic fallback was used.`.slice(0, 400),
      source: 'fallback',
    };
  }

  return {
    ...selection,
    relevantFiles,
    source: 'search',
    reason: `${selection.reason} Searched for "${selection.searchQuery}" and added ${searchedFiles.length} matched file(s).`.slice(0, 400),
  };
}

export function checkWorkflowProject(
  context: AgentWorkflowContext,
  projectDirectory: string,
  agent?: AgentProtocolRecorder,
): Promise<ToolResult<CheckProjectOutput>> {
  return executeWorkflowTool<CheckProjectOutput>(
    context,
    'check_project',
    {},
    projectDirectory,
    agent,
  );
}
