package io.yakable.core.project;

import java.time.Instant;
import java.util.Objects;

public record Project(
        String id,
        String name,
        String prompt,
        String provider,
        String model,
        ProjectStatus status,
        Instant createdAt,
        Instant updatedAt
) {

    public Project {
        id = requireText(id, "id");
        name = requireText(name, "name");
        prompt = requireText(prompt, "prompt");
        provider = requireText(provider, "provider");
        model = requireText(model, "model");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
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
