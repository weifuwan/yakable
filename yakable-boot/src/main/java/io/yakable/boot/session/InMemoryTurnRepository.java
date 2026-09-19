package io.yakable.boot.session;

import io.yakable.core.session.Turn;
import io.yakable.core.session.TurnRepository;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

final class InMemoryTurnRepository implements TurnRepository {

    private final ConcurrentMap<String, Turn> turns = new ConcurrentHashMap<>();

    @Override
    public Turn save(Turn turn) {
        turns.put(turn.id(), turn);
        return turn;
    }

    @Override
    public Optional<Turn> findById(String turnId) {
        return Optional.ofNullable(turns.get(turnId));
    }

    @Override
    public List<Turn> findBySessionId(String sessionId) {
        return turns.values().stream()
                .filter(turn -> turn.sessionId().equals(sessionId))
                .toList();
    }
}
