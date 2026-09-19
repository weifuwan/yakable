package io.yakable.application.context;

import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.Turn;
import io.yakable.domain.session.TurnStatus;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

public final class DefaultContextPolicy implements ContextPolicy {

    private static final String SYSTEM_INSTRUCTIONS =
            "You are Yakable, a concise and accurate assistant.";

    @Override
    public ContextBundle resolve(
            Session session,
            Turn currentTurn,
            List<Turn> turns,
            List<SessionMessage> messages
    ) {
        Objects.requireNonNull(session, "session");
        Objects.requireNonNull(currentTurn, "currentTurn");
        Objects.requireNonNull(turns, "turns");
        Objects.requireNonNull(messages, "messages");

        if (!currentTurn.sessionId().equals(session.id())) {
            throw new IllegalArgumentException(
                    "currentTurn must belong to session"
            );
        }

        Map<String, Turn> turnsById = turns.stream()
                .filter(turn ->
                        turn.sessionId().equals(session.id())
                )
                .collect(Collectors.toMap(
                        Turn::id,
                        Function.identity()
                ));

        List<SessionMessage> conversation = messages.stream()
                .filter(message ->
                        message.sessionId().equals(session.id())
                )
                .sorted(
                        Comparator.comparingLong(
                                SessionMessage::sequence
                        )
                )
                .filter(message ->
                        admitMessage(
                                message,
                                currentTurn.id(),
                                turnsById
                        )
                )
                .toList();

        return new ContextBundle(
                SYSTEM_INSTRUCTIONS,
                conversation
        );
    }

    private static boolean admitMessage(
            SessionMessage message,
            String currentTurnId,
            Map<String, Turn> turnsById
    ) {
        if (message.turnId().equals(currentTurnId)) {
            return true;
        }

        Turn turn = turnsById.get(message.turnId());
        return turn != null
                && turn.status() == TurnStatus.SUCCEEDED;
    }
}
