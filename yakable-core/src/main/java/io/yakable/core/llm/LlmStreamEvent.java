package io.yakable.core.llm;

import java.util.Objects;

/**
 * LLM 流式事件。
 */
public record LlmStreamEvent(Type type, String delta, LlmResponse response) {

    public LlmStreamEvent {
        Objects.requireNonNull(type, "type");
        if (type == Type.DELTA && (delta == null || delta.isEmpty())) {
            throw new IllegalArgumentException("delta must not be empty");
        }
        if (type == Type.COMPLETE) {
            Objects.requireNonNull(response, "response");
        }
    }

    public static LlmStreamEvent delta(String content) {
        return new LlmStreamEvent(Type.DELTA, content, null);
    }

    public static LlmStreamEvent complete(LlmResponse response) {
        return new LlmStreamEvent(Type.COMPLETE, null, response);
    }

    public enum Type {
        DELTA,
        COMPLETE
    }
}
