package io.yakable.core.llm;

import java.util.Objects;

public record LlmMessage(
        Role role,
        String content
) {

    public LlmMessage {
        Objects.requireNonNull(role, "role");
        content = requireText(content, "content");
    }

    private static String requireText(String value, String field) {
        Objects.requireNonNull(value, field);
        String normalized = value.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return normalized;
    }

    public enum Role {
        USER,
        ASSISTANT
    }
}
