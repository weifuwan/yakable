package io.yakable.application.context;

import io.yakable.domain.session.SessionMessage;

import java.util.List;
import java.util.Objects;

public record ContextBundle(
        String systemInstructions,
        List<SessionMessage> conversation
) {

    public ContextBundle {
        systemInstructions = requireText(
                systemInstructions,
                "systemInstructions"
        );
        conversation = List.copyOf(
                Objects.requireNonNull(
                        conversation,
                        "conversation"
                )
        );
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
}
