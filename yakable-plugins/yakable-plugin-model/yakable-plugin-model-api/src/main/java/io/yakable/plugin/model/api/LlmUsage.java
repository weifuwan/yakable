package io.yakable.plugin.model.api;

public record LlmUsage(
        Long inputTokens,
        Long outputTokens,
        Long totalTokens
) {
}
