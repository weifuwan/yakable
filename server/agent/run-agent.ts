import type {
  AIProvider,
  ProviderMessage,
  ToolResultContentBlock,
  ToolUseContentBlock,
} from '../ai/types.js';
import {
  ensureProject,
  getProjectSnapshot,
  type ProjectSnapshot,
} from '../project/project-store.js';
import { createProjectTools, type AgentPlan, type AgentState } from './tools.js';

const MAX_AGENT_STEPS = 10;
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 8000;
const MAX_RUNTIME_ERROR_LENGTH = 12000;

export type AgentRunMode = 'implementation' | 'repair';

export interface AgentRunOptions {
  mode?: AgentRunMode;
  runtimeError?: string;
}

function systemPrompt(options: AgentRunOptions) {
  const base = `You are Yakable's coding agent.

Your job is to turn a user's product request into a real generated frontend project.

The generated-project stack is fixed by Yakable:
- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React is available for icons

Current capabilities:
- The generated project persists across conversation turns under the same projectId.
- You can inspect and list the current project.
- You can read existing project files.
- You can make precise edits with replace_in_file.
- You can create or replace files under src/ and public/ with write_file.
- Root configuration files are intentionally locked so the MVP stack stays deterministic.
- You cannot execute arbitrary shell commands or install user-selected packages.
- After your turn, Yakable synchronizes the source into a controlled Vite Preview Runtime and validates the generated modules.

For normal implementation requests:
1. Treat follow-up requests as edits to the existing project, not a request to rebuild from scratch.
2. Inspect the workspace before making changes.
3. Record a concise plan with set_plan.
4. Read the relevant existing files before editing them.
5. Preserve unrelated code and styling. Prefer replace_in_file for a small localized change; use write_file when the structure genuinely needs a larger rewrite.
6. Keep the project runnable with the fixed stack and do not invent unavailable packages.
7. End with a short user-facing summary naming what changed. Do not claim runtime verification passed because the server validates the Preview after your turn.

Never claim that arbitrary commands ran. The Preview Runtime is a separate controlled execution boundary.`;

  if (options.mode !== 'repair') {
    return base;
  }

  const runtimeError = (options.runtimeError ?? 'Unknown Preview Runtime error').slice(
    0,
    MAX_RUNTIME_ERROR_LENGTH,
  );

  return `${base}

You are now in Yakable's automatic repair pass.
- Fix only the root cause of the Preview Runtime failure.
- Do not redesign, restyle, or remove working functionality unless the error requires it.
- Inspect and read the implicated files before changing them.
- Prefer the smallest safe edit.
- Do not introduce new dependencies.
- If the error points to a missing module, use only packages already in the fixed stack or replace the unsupported dependency with local code.

Preview Runtime error to repair:
${runtimeError}`;
}

export interface AgentHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentEvent {
  tool: string;
  status: 'success' | 'error';
}

export interface AgentRunResult {
  message: string;
  provider: string;
  model: string;
  plan?: AgentPlan;
  events: AgentEvent[];
  project: ProjectSnapshot;
  changedFiles: string[];
}

function textMessage(role: AgentHistoryMessage['role'], text: string): ProviderMessage {
  return {
    role,
    content: [{ type: 'text', text: text.slice(0, MAX_MESSAGE_LENGTH) }],
  };
}

function stringifyToolResult(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export async function runAgent(
  provider: AIProvider,
  projectId: string,
  message: string,
  history: AgentHistoryMessage[] = [],
  options: AgentRunOptions = {},
): Promise<AgentRunResult> {
  ensureProject(projectId);

  const tools = createProjectTools();
  const toolMap = new Map(tools.map((tool) => [tool.definition.name, tool]));
  const state: AgentState = { projectId, changedFiles: [] };
  const events: AgentEvent[] = [];
  const messages: ProviderMessage[] = [
    ...history.slice(-MAX_HISTORY_MESSAGES).map((item) => textMessage(item.role, item.content)),
    textMessage('user', message),
  ];

  for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
    const response = await provider.generate({
      systemPrompt: systemPrompt(options),
      messages,
      tools: tools.map((tool) => tool.definition),
    });

    messages.push({ role: 'assistant', content: response.content });

    const toolCalls = response.content.filter(
      (block): block is ToolUseContentBlock => block.type === 'tool_use',
    );

    if (toolCalls.length === 0) {
      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();

      return {
        message:
          text ||
          `The agent stopped without a user-facing response (stop reason: ${response.stopReason ?? 'unknown'}).`,
        provider: provider.name,
        model: provider.model,
        plan: state.plan,
        events,
        project: getProjectSnapshot(projectId),
        changedFiles: state.changedFiles,
      };
    }

    const toolResults: ToolResultContentBlock[] = [];

    for (const call of toolCalls) {
      const tool = toolMap.get(call.name);

      if (!tool) {
        events.push({ tool: call.name, status: 'error' });
        toolResults.push({
          type: 'tool_result',
          toolUseId: call.id,
          toolName: call.name,
          content: `Unknown tool: ${call.name}`,
          isError: true,
        });
        continue;
      }

      try {
        const result = await tool.execute(call.input, state);
        events.push({ tool: call.name, status: 'success' });
        toolResults.push({
          type: 'tool_result',
          toolUseId: call.id,
          toolName: call.name,
          content: stringifyToolResult(result),
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Tool execution failed';
        events.push({ tool: call.name, status: 'error' });
        toolResults.push({
          type: 'tool_result',
          toolUseId: call.id,
          toolName: call.name,
          content: detail,
          isError: true,
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }

  throw new Error(`Agent exceeded the ${MAX_AGENT_STEPS}-step safety limit`);
}
