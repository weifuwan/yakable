export interface ModelGeneration {
  content: string;
  model: string;
}

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StructuredModelRequest {
  systemPrompt: string;
  userPrompt: string;
  capabilityLabel: string;
  maxTokens?: number;
}

export interface TextModelRequest {
  messages: ModelMessage[];
  capabilityLabel: string;
  maxTokens?: number;
}

/**
 * Provider-neutral model boundary.
 *
 * Feature modules own prompts, parsing, retries, and workflow semantics.
 * Providers own transport, auth, timeouts, model selection, and
 * provider-specific request details.
 */
export interface ModelClient {
  readonly id: string;
  generateStructured(request: StructuredModelRequest): Promise<ModelGeneration>;
  generateText(request: TextModelRequest): Promise<ModelGeneration>;
}
