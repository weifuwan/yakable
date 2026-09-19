package io.yakable.plugin.model.api;

import java.util.Objects;

public record LlmResponse(
        String content,
        LlmUsage usage,
        String model,
        String providerRequestId,
        String finishReason
) {

    public LlmResponse {
        Objects.requireNonNull(content, "content");
        content = content.strip();
        if (content.isEmpty()) {
            throw new IllegalArgumentException(
                    "content must not be blank"
            );
        }
        usage = usage == null
                ? new LlmUsage(null, null, null)
                : usage;
        model = normalizeOptionalText(model);
        providerRequestId = normalizeOptionalText(
                providerRequestId
        );
        finishReason = normalizeOptionalText(finishReason);
    }

    public LlmResponse(
            String content,
            LlmUsage usage
    ) {
        this(content, usage, null, null, null);
    }

    public LlmResponse(
            String content,
            LlmUsage usage,
            String providerRequestId,
            String finishReason
    ) {
        this(
                content,
                usage,
                null,
                providerRequestId,
                finishReason
        );
    }

    private static String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.strip();
        return normalized.isEmpty() ? null : normalized;
    }
}
