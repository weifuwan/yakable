import { AnthropicProvider } from './anthropic-provider.js';
import { MockProvider } from './mock-provider.js';
import type { AIProvider } from './types.js';

export function createProviderFromEnv(): AIProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!apiKey) {
    return new MockProvider();
  }

  return new AnthropicProvider({
    apiKey,
    model: process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-5',
    baseUrl: process.env.ANTHROPIC_BASE_URL?.trim() || undefined,
  });
}
