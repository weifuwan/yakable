export interface ModelGeneration {
  content: string;
  model: string;
}

export interface StructuredModelRequest {
  systemPrompt: string;
  userPrompt: string;
  capabilityLabel: string;
}

/**
 * Provider-neutral boundary for structured model generation.
 *
 * Feature modules own prompts and parsing. Providers own transport, auth,
 * timeouts, model selection, and provider-specific request details.
 */
export interface ModelClient {
  readonly id: string;
  generateStructured(request: StructuredModelRequest): Promise<ModelGeneration>;
}
