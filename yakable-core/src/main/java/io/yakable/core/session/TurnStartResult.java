package io.yakable.core.session;

import java.util.Objects;

public record TurnStartResult(
        Turn turn,
        SessionMessage userMessage
) {

    public TurnStartResult {
        Objects.requireNonNull(turn, "turn");
        Objects.requireNonNull(userMessage, "userMessage");
    }
}
