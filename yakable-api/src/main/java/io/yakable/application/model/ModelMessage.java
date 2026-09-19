package io.yakable.application.model;

import java.util.Objects;

public record ModelMessage(
        Role role,
        String content
) {

    public ModelMessage {
        Objects.requireNonNull(role, "role");
        Objects.requireNonNull(content, "content");
    }

    public enum Role {
        USER,
        ASSISTANT
    }
}
