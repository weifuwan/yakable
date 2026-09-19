package io.yakable.core.session;

import io.yakable.plugin.model.api.LlmMessage;
import io.yakable.plugin.model.api.LlmRequest;

import java.util.List;
import java.util.Objects;

public final class TurnPromptAssembler {

    private static final String SYSTEM_PROMPT =
            "You are Yakable, a concise and accurate assistant.";

    public LlmRequest assemble(
            Session session,
            List<SessionMessage> messages
    ) {
        Objects.requireNonNull(session, "session");
        Objects.requireNonNull(messages, "messages");

        List<LlmMessage> history = messages.stream()
                .map(TurnPromptAssembler::toLlmMessage)
                .toList();

        return new LlmRequest(
                session.model(),
                SYSTEM_PROMPT,
                history
        );
    }

    private static LlmMessage toLlmMessage(
            SessionMessage message
    ) {
        LlmMessage.Role role = switch (message.role()) {
            case USER -> LlmMessage.Role.USER;
            case ASSISTANT -> LlmMessage.Role.ASSISTANT;
        };
        return new LlmMessage(role, message.content());
    }
}
