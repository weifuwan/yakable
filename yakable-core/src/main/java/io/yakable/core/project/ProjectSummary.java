package io.yakable.core.project;

import java.time.Instant;
import java.util.Objects;

public record ProjectSummary(
        String id,
        String name,
        Instant updatedAt
) {

    public ProjectSummary {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(updatedAt, "updatedAt");
    }
}
