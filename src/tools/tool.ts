import type { AgentProtocolRecorder } from '../protocol/agent-recorder.js';

export interface ToolContext {
  projectDirectory: string;
  agent?: AgentProtocolRecorder;
}

export interface ToolError {
  code: string;
  message: string;
}

export type ToolResult<Output> =
  | { ok: true; value: Output }
  | { ok: false; error: ToolError };

export interface Tool<Input = unknown, Output = unknown> {
  readonly name: string;
  readonly description: string;
  execute(input: Input, context: ToolContext): Promise<ToolResult<Output>>;
}

export interface RegisteredTool {
  name: string;
  description: string;
}

export class ToolRegistry {
  private readonly tools = new Map<string, Tool<any, any>>();

  register<Input, Output>(tool: Tool<Input, Output>): this {
    const name = tool.name.trim();
    if (!name || name !== tool.name) {
      throw new Error('Tool name must be a non-empty trimmed string.');
    }
    if (this.tools.has(name)) {
      throw new Error(`Tool is already registered: ${name}`);
    }

    this.tools.set(name, tool);
    return this;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): RegisteredTool[] {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }

  async execute<Output = unknown>(
    name: string,
    input: unknown,
    context: ToolContext,
  ): Promise<ToolResult<Output>> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        ok: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool is not registered: ${name}`,
        },
      };
    }

    return tool.execute(input, context) as Promise<ToolResult<Output>>;
  }
}
