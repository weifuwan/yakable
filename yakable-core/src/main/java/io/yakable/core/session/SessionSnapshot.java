package io.yakable.core.session;

import java.util.List;
import java.util.Objects;

public record SessionSnapshot(
        Session session,
        List<Turn> turns,
        List<SessionMessage> messages
) {

    public SessionSnapshot {
        Objects.requireNonNull(session, "session");
        turns = List.copyOf(Objects.requireNonNull(turns, "turns"));
        messages = List.copyOf(Objects.requireNonNull(messages, "messages"));
    }
}
