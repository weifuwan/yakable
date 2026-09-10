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

export function createProjectTools(): AgentTool[] {
  return [
    {
      definition: {
        name: 'inspect_workspace',
        description:
          'Inspect the generated React/Vite/Tailwind project, its files, and the capabilities available in the current Yakable phase.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
      async execute(_input, state) {
        return {
          phase: 'project-generation',
          stack: ['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Lucide React'],
          writableRoots: ['src/', 'public/'],
          commandExecution: false,
          sandboxProvisioned: false,
          preview: 'static-shell',
          project: getProjectSnapshot(state.projectId),
          nextBoundary: 'Sandbox runtime and live preview',
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
        description: 'List the files currently present in the generated project.',
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
        name: 'write_file',
        description:
          'Create or replace a UTF-8 file under src/ or public/ in the generated project. Root configuration is intentionally locked by Yakable.',
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

        if (!state.changedFiles.includes(result.path)) {
          state.changedFiles.push(result.path);
        }

        return result;
      },
    },
  ];
}
