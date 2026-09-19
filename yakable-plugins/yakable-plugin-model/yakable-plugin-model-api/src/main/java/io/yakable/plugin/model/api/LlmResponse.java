package io.yakable.plugin.model.api;

import java.util.Objects;

public record LlmResponse(
        String content,
        LlmUsage usage
) {

    public LlmResponse {
        Objects.requireNonNull(content, "content");
        content = content.strip();
        if (content.isEmpty()) {
            throw new IllegalArgumentException("content must not be blank");
        }
    }
}
