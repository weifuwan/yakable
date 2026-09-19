package io.yakable.core.project;

import java.util.Objects;

public record StartProjectCommand(
        String prompt,
        String provider,
        String model
) {

    public StartProjectCommand {
        prompt = requireText(prompt, "prompt");
        provider = requireText(provider, "provider");
        model = requireText(model, "model");
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
