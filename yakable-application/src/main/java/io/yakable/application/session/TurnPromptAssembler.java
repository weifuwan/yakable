package io.yakable.application.session;

import io.yakable.application.model.ModelMessage;
import io.yakable.application.model.ModelRequest;
import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionMessage;

import java.util.List;
import java.util.Objects;

public final class TurnPromptAssembler {

    private static final String SYSTEM_PROMPT =
            "You are Yakable, a concise and accurate assistant.";

    public ModelRequest assemble(
            Session session,
            List<SessionMessage> messages
    ) {
        Objects.requireNonNull(session, "session");
        Objects.requireNonNull(messages, "messages");

        List<ModelMessage> history = messages.stream()
                .map(TurnPromptAssembler::toModelMessage)
                .toList();

        return new ModelRequest(
                session.model(),
                SYSTEM_PROMPT,
                history
        );
    }

    private static ModelMessage toModelMessage(
            SessionMessage message
    ) {
        ModelMessage.Role role = switch (message.role()) {
            case USER -> ModelMessage.Role.USER;
            case ASSISTANT -> ModelMessage.Role.ASSISTANT;
        };
        return new ModelMessage(role, message.content());
    }
}
