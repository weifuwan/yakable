package io.yakable.core.llm;

import java.util.Objects;

/**
 * LLM 会话消息。
 */
public record LlmMessage(Role role, String content) {

    public LlmMessage {
        Objects.requireNonNull(role, "role");
        Objects.requireNonNull(content, "content");
        if (content.isBlank()) {
            throw new IllegalArgumentException("content must not be blank");
        }
    }

    public enum Role {
        USER,
        ASSISTANT
    }
}
