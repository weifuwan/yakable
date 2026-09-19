package io.yakable.application.model;

import java.util.List;
import java.util.Objects;

public record ModelRequest(
        String model,
        String systemPrompt,
        List<ModelMessage> messages
) {

    public ModelRequest {
        model = requireText(model, "model");
        systemPrompt = requireText(systemPrompt, "systemPrompt");
        messages = List.copyOf(
                Objects.requireNonNull(messages, "messages")
        );
    }

    private static String requireText(String value, String field) {
        Objects.requireNonNull(value, field);
        String normalized = value.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return normalized;
    }
}
