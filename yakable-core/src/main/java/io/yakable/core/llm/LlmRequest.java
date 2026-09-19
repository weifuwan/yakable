package io.yakable.core.llm;

import java.util.List;
import java.util.Objects;

public record LlmRequest(
        String model,
        String system,
        List<LlmMessage> messages
) {

    public LlmRequest {
        model = requireText(model, "model");
        system = normalizeOptionalText(system);
        Objects.requireNonNull(messages, "messages");
        messages = List.copyOf(messages);
        if (messages.isEmpty()) {
            throw new IllegalArgumentException("messages must not be empty");
        }
    }

    private static String requireText(String value, String field) {
        Objects.requireNonNull(value, field);
        String normalized = value.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return normalized;
    }

    private static String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.strip();
        return normalized.isEmpty() ? null : normalized;
    }
}
