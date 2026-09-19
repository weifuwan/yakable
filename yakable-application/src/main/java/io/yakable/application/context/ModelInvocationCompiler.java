package io.yakable.application.context;

import io.yakable.application.model.ModelMessage;
import io.yakable.application.model.ModelRequest;
import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionMessage;

import java.util.List;
import java.util.Objects;

public final class ModelInvocationCompiler {

    public ModelRequest compile(
            Session session,
            ContextBundle context
    ) {
        Objects.requireNonNull(session, "session");
        Objects.requireNonNull(context, "context");

        List<ModelMessage> messages = context.conversation()
                .stream()
                .map(ModelInvocationCompiler::toModelMessage)
                .toList();

        return new ModelRequest(
                session.model(),
                context.systemInstructions(),
                messages
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
