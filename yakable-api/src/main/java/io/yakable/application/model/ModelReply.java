package io.yakable.application.model;

import java.util.Objects;

public record ModelReply(
        String content,
        String provider,
        String model,
        ModelUsage usage,
        String providerRequestId,
        String finishReason
) {

    public ModelReply {
        content = requireText(content, "content");
        provider = requireText(provider, "provider");
        model = requireText(model, "model");
        Objects.requireNonNull(usage, "usage");
        providerRequestId = normalizeOptionalText(providerRequestId);
        finishReason = normalizeOptionalText(finishReason);
    }

    private static String requireText(
            String value,
            String field
    ) {
        Objects.requireNonNull(value, field);
        String normalized = value.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(
                    field + " must not be blank"
            );
        }
        return normalized;
    }

    private static String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.strip();
        return normalized.isEmpty() ? null : normalized;
    }
}
