import type {
  AIProvider,
  ProviderMessage,
  ToolResultContentBlock,
  ToolUseContentBlock,
} from '../ai/types.js';
import { ensureProject, getProjectSnapshot, type ProjectSnapshot } from '../project/project-store.js';
import { createProjectTools, type AgentPlan, type AgentState } from './tools.js';

const MAX_AGENT_STEPS = 10;
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 8000;

const SYSTEM_PROMPT = `You are Yakable's coding agent.

Your job is to turn a user's product request into a real generated frontend project.

The generated-project stack is fixed by Yakable:
- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React is available for icons

Current capabilities:
- You can inspect and list the generated project.
- You can read existing project files.
- You can create or replace files under src/ and public/.
- Root configuration files are intentionally locked so the MVP stack stays deterministic.
- You cannot execute arbitrary shell commands or install user-selected packages.
- After your turn, Yakable automatically synchronizes the generated source into a controlled Vite Preview Runtime.

For implementation requests:
1. Inspect the workspace before making changes.
2. Record a concise plan with set_plan.
3. Read relevant existing files before replacing them.
4. Use write_file to actually implement the request. Prefer a small, coherent component structure instead of one huge file when the UI benefits from it.
5. Keep the project runnable with the fixed stack and do not invent unavailable packages.
6. End with a short user-facing summary naming what you changed. You may say Yakable will refresh the Preview after the turn, but do not claim the runtime is healthy because runtime status is determined by the server after your response.

Never claim that arbitrary commands ran or that runtime verification passed. The Preview Runtime is a separate controlled execution boundary.`;

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
      systemPrompt: SYSTEM_PROMPT,
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
