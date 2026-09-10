export type JsonObject = Record<string, unknown>;

export interface TextContentBlock {
  type: 'text';
  text: string;
}

export interface ToolUseContentBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: JsonObject;
}

export interface ToolResultContentBlock {
  type: 'tool_result';
  toolUseId: string;
  toolName: string;
  content: string;
  isError?: boolean;
}

export type ProviderContentBlock =
  | TextContentBlock
  | ToolUseContentBlock
  | ToolResultContentBlock;

export interface ProviderMessage {
  role: 'user' | 'assistant';
  content: ProviderContentBlock[];
}

export interface ProviderToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonObject;
}

export interface ProviderGenerateInput {
  systemPrompt: string;
  messages: ProviderMessage[];
  tools: ProviderToolDefinition[];
}

export interface ProviderResponse {
  content: Array<TextContentBlock | ToolUseContentBlock>;
  stopReason?: string | null;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generate(input: ProviderGenerateInput): Promise<ProviderResponse>;
}
