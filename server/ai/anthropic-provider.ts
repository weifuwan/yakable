import type {
  AIProvider,
  JsonObject,
  ProviderContentBlock,
  ProviderGenerateInput,
  ProviderResponse,
} from './types.js';

interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

interface AnthropicResponseBody {
  content?: AnthropicContentBlock[];
  stop_reason?: string | null;
  error?: {
    message?: string;
  };
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toAnthropicContent(block: ProviderContentBlock): Record<string, unknown> {
  if (block.type === 'text') {
    return { type: 'text', text: block.text };
  }

  if (block.type === 'tool_use') {
    return {
      type: 'tool_use',
      id: block.id,
      name: block.name,
      input: block.input,
    };
  }

  return {
    type: 'tool_result',
    tool_use_id: block.toolUseId,
    content: block.content,
    is_error: block.isError ?? false,
  };
}

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: AnthropicProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = (options.baseUrl ?? 'https://api.anthropic.com').replace(/\/+$/, '');
  }

  async generate(input: ProviderGenerateInput): Promise<ProviderResponse> {
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        thinking: { type: 'disabled' },
        system: input.systemPrompt,
        messages: input.messages.map((message) => ({
          role: message.role,
          content: message.content.map(toAnthropicContent),
        })),
        tools: input.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        })),
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as AnthropicResponseBody;

    if (!response.ok) {
      const detail = payload.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`Anthropic request failed: ${detail}`);
    }

    const content: ProviderResponse['content'] = [];

    for (const block of payload.content ?? []) {
      if (block.type === 'text' && typeof block.text === 'string') {
        content.push({ type: 'text', text: block.text });
        continue;
      }

      if (
        block.type === 'tool_use' &&
        typeof block.id === 'string' &&
        typeof block.name === 'string'
      ) {
        content.push({
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: isJsonObject(block.input) ? block.input : {},
        });
      }
    }

    return {
      content,
      stopReason: payload.stop_reason,
    };
  }
}
