import { checkProjectTool } from '../tools/check-project.js';
import { readProjectFileTool } from '../tools/read-project-file.js';
import { searchProjectTool } from '../tools/search-project.js';
import {
  ToolRegistry,
  type Tool,
  type ToolContext,
  type ToolResult,
} from '../tools/tool.js';

export interface RoutedTool {
  name: string;
  description: string;
}

/**
 * Runtime-facing tool registry.
 *
 * Tool availability is defined by explicit registration. Permission and
 * approval policy belong to dedicated runtime boundaries instead of a
 * global Plan / Build mode switch.
 */
export class ToolRouter {
  private readonly registry = new ToolRegistry();
  private readonly routes = new Map<string, RoutedTool>();

  register<Input, Output>(tool: Tool<Input, Output>): this {
    this.registry.register(tool);
    this.routes.set(tool.name, {
      name: tool.name,
      description: tool.description,
    });
    return this;
  }

  has(name: string): boolean {
    return this.routes.has(name);
  }

  list(): RoutedTool[] {
    return [...this.routes.values()].map((route) => ({ ...route }));
  }

  async execute<Output = unknown>(
    name: string,
    input: unknown,
    context: ToolContext,
  ): Promise<ToolResult<Output>> {
    if (!this.routes.has(name)) {
      return {
        ok: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool is not registered: ${name}`,
        },
      };
    }

    return this.registry.execute<Output>(name, input, context);
  }
}

export function createDefaultToolRouter(): ToolRouter {
  return new ToolRouter()
    .register(readProjectFileTool)
    .register(searchProjectTool)
    .register(checkProjectTool);
}
