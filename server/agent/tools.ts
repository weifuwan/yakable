import type { JsonObject, ProviderToolDefinition } from '../ai/types.js';

export interface AgentPlan {
  summary: string;
  steps: string[];
}

export interface AgentState {
  plan?: AgentPlan;
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

function readSteps(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('steps must be a non-empty array');
  }

  return value.slice(0, 8).map((step, index) => readString(step, `steps[${index}]`));
}

export function createFoundationTools(): AgentTool[] {
  return [
    {
      definition: {
        name: 'inspect_workspace',
        description:
          'Inspect the current Yakable generated-project boundary before planning implementation work.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
      async execute() {
        return {
          phase: 'agent-foundation',
          projectTemplate: ['React', 'TypeScript', 'Vite', 'Tailwind CSS'],
          writableProjectFiles: false,
          commandExecution: false,
          sandboxProvisioned: false,
          preview: 'static-shell',
          nextBoundary: 'project generation and writable workspace tools',
        };
      },
    },
    {
      definition: {
        name: 'set_plan',
        description:
          'Record the concrete implementation plan for the current user request. This does not modify files.',
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
  ];
}
