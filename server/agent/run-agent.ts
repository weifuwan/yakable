import type {
  AIProvider,
  ProviderMessage,
  ToolResultContentBlock,
  ToolUseContentBlock,
} from '../ai/types.js';
import {
  createFoundationTools,
  type AgentPlan,
  type AgentState,
} from './tools.js';

const MAX_AGENT_STEPS = 6;
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 8000;

const SYSTEM_PROMPT = `You are Yakable's coding agent.

Your job is to turn a user's product request into concrete implementation work.

This repository is currently in the Agent Foundation phase:
- You can inspect the workspace boundary.
- You can record an implementation plan.
- You cannot write project files yet.
- You cannot run shell commands yet.
- You do not have a Sandbox yet.

For implementation requests, inspect the workspace before planning. Record a concise, actionable plan with set_plan. Never claim that code was changed, commands were executed, or a preview was updated when those capabilities are unavailable. End with a short user-facing summary of what is ready and what the next execution boundary is.`;

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
  message: string,
  history: AgentHistoryMessage[] = [],
): Promise<AgentRunResult> {
  const tools = createFoundationTools();
  const toolMap = new Map(tools.map((tool) => [tool.definition.name, tool]));
  const state: AgentState = {};
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
