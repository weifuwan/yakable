package io.yakable.application.session;

import io.yakable.domain.session.SessionMessage;

import java.util.List;
import java.util.Objects;

public record SessionMessagePage(
        List<SessionMessage> messages,
        Long nextBeforeSequence,
        boolean hasMore
) {

    public SessionMessagePage {
        messages = List.copyOf(
                Objects.requireNonNull(messages, "messages")
        );
        if (nextBeforeSequence != null
                && nextBeforeSequence <= 0) {
            throw new IllegalArgumentException(
                    "nextBeforeSequence must be positive"
            );
        }
        if (!hasMore && nextBeforeSequence != null) {
            throw new IllegalArgumentException(
                    "nextBeforeSequence requires hasMore"
            );
        }
    }
}
