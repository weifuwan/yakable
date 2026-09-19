package io.yakable.domain.session;

import java.time.Instant;
import java.util.Objects;

public record SessionMessage(
        String id,
        String sessionId,
        String turnId,
        Role role,
        String content,
        long sequence,
        Instant createdAt
) {

    public SessionMessage {
        id = requireText(id, "id");
        sessionId = requireText(sessionId, "sessionId");
        turnId = requireText(turnId, "turnId");
        Objects.requireNonNull(role, "role");
        content = requireText(content, "content");
        if (sequence <= 0) {
            throw new IllegalArgumentException(
                    "sequence must be greater than zero"
            );
        }
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
