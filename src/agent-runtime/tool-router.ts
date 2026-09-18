import {
  modeAllowsCapability,
  type YakableMode,
  type YakableModeCapability,
} from '../modes/mode-contract.js';
import { checkProjectTool } from '../tools/check-project.js';
import { readProjectFileTool } from '../tools/read-project-file.js';
import { searchProjectTool } from '../tools/search-project.js';
import {
  ToolRegistry,
  type Tool,
  type ToolContext,
  type ToolResult,
} from '../tools/tool.js';

export interface ToolRouteOptions {
  capability?: YakableModeCapability;
}

export interface RoutedTool {
  name: string;
  description: string;
  capability?: YakableModeCapability;
}

/**
 * Runtime-facing tool boundary.
 *
 * The existing ToolRegistry remains the executor registry. ToolRouter adds
 * mode/capability exposure so workflows no longer need to own that policy.
 */
export class ToolRouter {
  private readonly registry = new ToolRegistry();
  private readonly routes = new Map<string, RoutedTool>();

  register<Input, Output>(tool: Tool<Input, Output>, options: ToolRouteOptions = {}): this {
    this.registry.register(tool);
    this.routes.set(tool.name, {
      name: tool.name,
      description: tool.description,
      ...(options.capability ? { capability: options.capability } : {}),
    });
    return this;
  }

  has(name: string): boolean {
    return this.routes.has(name);
  }

  list(mode?: YakableMode): RoutedTool[] {
    return [...this.routes.values()]
      .filter((route) => !mode || !route.capability || modeAllowsCapability(mode, route.capability))
      .map((route) => ({ ...route }));
  }

  async execute<Output = unknown>(
    mode: YakableMode,
    name: string,
    input: unknown,
    context: ToolContext,
  ): Promise<ToolResult<Output>> {
    const route = this.routes.get(name);
    if (!route) {
      return {
        ok: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool is not registered: ${name}`,
        },
      };
    }

    if (route.capability && !modeAllowsCapability(mode, route.capability)) {
      return {
        ok: false,
        error: {
          code: 'TOOL_CAPABILITY_FORBIDDEN',
          message: `${mode} mode does not allow ${route.capability} required by ${name}.`,
        },
      };
    }

    return this.registry.execute<Output>(name, input, context);
  }
}

export function createDefaultToolRouter(): ToolRouter {
  return new ToolRouter()
    .register(readProjectFileTool, { capability: 'read-project' })
    .register(searchProjectTool, { capability: 'search-project' })
    .register(checkProjectTool, { capability: 'read-project' });
}
