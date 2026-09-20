package io.yakable.core.llm;

import java.util.List;
import java.util.Objects;

/**
 * LLM 统一请求。
 */
public record LlmRequest(
        String provider,
        String model,
        String system,
        List<LlmMessage> messages) {

    public LlmRequest {
        requireText(provider, "provider");
        requireText(model, "model");
        if (system != null && system.isBlank()) {
            throw new IllegalArgumentException("system must not be blank");
        }
        Objects.requireNonNull(messages, "messages");
        messages = List.copyOf(messages);
        if (messages.isEmpty()) {
            throw new IllegalArgumentException("messages must not be empty");
        }
    }

    private static void requireText(String value, String field) {
        Objects.requireNonNull(value, field);
        if (value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
    }
}
