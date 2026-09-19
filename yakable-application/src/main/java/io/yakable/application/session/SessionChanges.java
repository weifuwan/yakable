package io.yakable.application.session;

import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.Turn;

import java.util.List;
import java.util.Objects;

public record SessionChanges(
        Turn latestTurn,
        List<SessionMessage> messages,
        long latestSequence
) {

    public SessionChanges {
        Objects.requireNonNull(latestTurn, "latestTurn");
        messages = List.copyOf(
                Objects.requireNonNull(messages, "messages")
        );
        if (latestSequence < 0) {
            throw new IllegalArgumentException(
                    "latestSequence must not be negative"
            );
        }
    }
}
