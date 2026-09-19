package io.yakable.core.conversation;

import java.time.Instant;
import java.util.Objects;

public record ConversationMessage(
        String id,
        String projectId,
        Role role,
        String content,
        Instant createdAt
) {

    public ConversationMessage {
        id = requireText(id, "id");
        projectId = requireText(projectId, "projectId");
        Objects.requireNonNull(role, "role");
        content = requireText(content, "content");
        Objects.requireNonNull(createdAt, "createdAt");
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
