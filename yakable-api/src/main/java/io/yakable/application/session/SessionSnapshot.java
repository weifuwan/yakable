package io.yakable.application.session;

import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.Turn;

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
