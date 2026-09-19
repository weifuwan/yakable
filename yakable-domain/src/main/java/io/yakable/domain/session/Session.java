package io.yakable.domain.session;

import java.time.Instant;
import java.util.Objects;

public record Session(
        String id,
        String projectId,
        String title,
        String provider,
        String model,
        SessionStatus status,
        Instant createdAt,
        Instant updatedAt
) {

    public Session {
        id = requireText(id, "id");
        projectId = requireText(projectId, "projectId");
        title = requireText(title, "title");
        provider = requireText(provider, "provider");
        model = requireText(model, "model");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
    }

    public Session touch(Instant now) {
        return new Session(
                id,
                projectId,
                title,
                provider,
                model,
                status,
                createdAt,
                Objects.requireNonNull(now, "now")
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
