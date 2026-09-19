package io.yakable.application.project;

import java.time.Instant;
import java.util.Objects;

public record ProjectSummary(
        String id,
        String name,
        String latestSessionId,
        Instant updatedAt
) {

    public ProjectSummary {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(latestSessionId, "latestSessionId");
        Objects.requireNonNull(updatedAt, "updatedAt");
    }
}
