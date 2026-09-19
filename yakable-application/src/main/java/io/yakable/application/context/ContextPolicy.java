package io.yakable.application.context;

import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.Turn;

import java.util.List;

public interface ContextPolicy {

    ContextBundle resolve(
            Session session,
            Turn currentTurn,
            List<Turn> turns,
            List<SessionMessage> messages
    );
}
