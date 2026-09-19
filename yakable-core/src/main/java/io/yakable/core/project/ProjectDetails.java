package io.yakable.core.project;

import java.time.Instant;
import java.util.Objects;

public record ProjectDetails(
        String id,
        String name,
        String latestSessionId,
        ProjectStatus status,
        Instant createdAt,
        Instant updatedAt
) {

    public ProjectDetails {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(latestSessionId, "latestSessionId");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
    }
}
