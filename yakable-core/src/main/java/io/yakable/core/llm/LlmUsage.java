package io.yakable.core.llm;

public record LlmUsage(
        Long inputTokens,
        Long outputTokens,
        Long totalTokens
) {
}
