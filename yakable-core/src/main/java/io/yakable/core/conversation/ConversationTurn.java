package io.yakable.core.conversation;

import java.util.Objects;

public record ConversationTurn(
        ConversationMessage userMessage,
        ConversationMessage assistantMessage
) {

    public ConversationTurn {
        Objects.requireNonNull(userMessage, "userMessage");
        Objects.requireNonNull(assistantMessage, "assistantMessage");

        if (userMessage.role() != ConversationMessage.Role.USER) {
            throw new IllegalArgumentException("userMessage must have USER role");
        }
        if (assistantMessage.role() != ConversationMessage.Role.ASSISTANT) {
            throw new IllegalArgumentException("assistantMessage must have ASSISTANT role");
        }
    }
}
