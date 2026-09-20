package io.yakable.core.llm;

/**
 * LLM Token 使用量。
 */
public record LlmUsage(Long inputTokens, Long outputTokens, Long totalTokens) {
}
