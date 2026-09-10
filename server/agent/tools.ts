import type { JsonObject, ProviderToolDefinition } from '../ai/types.js';
import {
  getProjectSnapshot,
  readProjectFile,
  writeProjectFile,
} from '../project/project-store.js';

export interface AgentPlan {
  summary: string;
  steps: string[];
}

export interface AgentState {
  projectId: string;
  plan?: AgentPlan;
  changedFiles: string[];
}

export interface AgentTool {
  definition: ProviderToolDefinition;
  execute(input: JsonObject, state: AgentState): Promise<unknown>;
}

function readString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }

  return value.trim();
}

function readContent(value: unknown) {
  if (typeof value !== 'string') {
    throw new Error('content must be a string');
  }

  return value;
}

function readSteps(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('steps must be a non-empty array');
  }

  return value.slice(0, 8).map((step, index) => readString(step, `steps[${index}]`));
}

function rememberChangedFile(state: AgentState, path: string) {
  if (!state.changedFiles.includes(path)) {
    state.changedFiles.push(path);
  }
}

export function createProjectTools(): AgentTool[] {
  return [
    {
      definition: {
        name: 'inspect_workspace',
        description:
          'Inspect the persistent generated React/Vite/Tailwind project, its files, and the capabilities available to the current Yakable turn.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
      async execute(_input, state) {
        return {
          phase: 'iterative-edit-and-repair',
          stack: ['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Lucide React'],
          projectPersistence: 'same projectId is reused across conversation turns',
          writableRoots: ['src/', 'public/'],
          commandExecution: false,
          arbitraryPackageInstall: false,
          preview: 'controlled-vite-runtime',
          runtimeValidation: true,
          automaticRepair: true,
          project: getProjectSnapshot(state.projectId),
        };
      },
    },
    {
      definition: {
        name: 'set_plan',
        description: 'Record a concise implementation plan for the current user request.',
        inputSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            steps: {
              type: 'array',
              minItems: 1,
              maxItems: 8,
              items: { type: 'string' },
            },
          },
          required: ['summary', 'steps'],
          additionalProperties: false,
        },
      },
      async execute(input, state) {
        const plan: AgentPlan = {
          summary: readString(input.summary, 'summary'),
          steps: readSteps(input.steps),
        };

        state.plan = plan;
        return plan;
      },
    },
    {
      definition: {
        name: 'list_files',
        description: 'List the files currently present in the persistent generated project.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
      async execute(_input, state) {
        return getProjectSnapshot(state.projectId).files;
      },
    },
    {
      definition: {
        name: 'read_file',
        description:
          'Read a UTF-8 source file from the generated project before deciding how to edit it.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
          },
          required: ['path'],
          additionalProperties: false,
        },
      },
      async execute(input, state) {
        return readProjectFile(state.projectId, readString(input.path, 'path'));
      },
    },
    {
      definition: {
        name: 'replace_in_file',
        description:
          'Make one precise replacement inside an existing src/ or public/ file. Prefer this for small follow-up edits so unrelated code is preserved. The old text must occur exactly once.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            oldText: { type: 'string' },
            newText: { type: 'string' },
          },
          required: ['path', 'oldText', 'newText'],
          additionalProperties: false,
        },
      },
      async execute(input, state) {
        const path = readString(input.path, 'path');
        const oldText = readString(input.oldText, 'oldText');
        const newText = readContent(input.newText);
        const file = readProjectFile(state.projectId, path);
        const firstIndex = file.content.indexOf(oldText);

        if (firstIndex < 0) {
          throw new Error(`replace_in_file could not find the requested text in ${path}`);
        }

        if (file.content.indexOf(oldText, firstIndex + oldText.length) >= 0) {
          throw new Error(
            `replace_in_file found the requested text more than once in ${path}; use a more specific oldText`,
          );
        }

        const nextContent =
          file.content.slice(0, firstIndex) +
          newText +
          file.content.slice(firstIndex + oldText.length);
        const result = writeProjectFile(state.projectId, path, nextContent);
        rememberChangedFile(state, result.path);

        return {
          ...result,
          replacedBytes: Buffer.byteLength(oldText, 'utf8'),
        };
      },
    },
    {
      definition: {
        name: 'write_file',
        description:
          'Create or replace a UTF-8 file under src/ or public/ in the generated project. Use this for structural changes; prefer replace_in_file for small localized edits. Root configuration is locked by Yakable.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['path', 'content'],
          additionalProperties: false,
        },
      },
      async execute(input, state) {
        const result = writeProjectFile(
          state.projectId,
          readString(input.path, 'path'),
          readContent(input.content),
        );

        rememberChangedFile(state, result.path);
        return result;
      },
    },
  ];
}
