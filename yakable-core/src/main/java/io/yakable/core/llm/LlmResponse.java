package io.yakable.core.llm;

import java.util.Objects;

/**
 * LLM 统一响应。
 */
public record LlmResponse(
        String provider,
        String model,
        String content,
        LlmUsage usage,
        String providerRequestId,
        String finishReason) {

    public LlmResponse {
        requireText(provider, "provider");
        requireText(model, "model");
        requireText(content, "content");
        usage = usage == null ? new LlmUsage(null, null, null) : usage;
    }

    private static void requireText(String value, String field) {
        Objects.requireNonNull(value, field);
        if (value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
    }
}
