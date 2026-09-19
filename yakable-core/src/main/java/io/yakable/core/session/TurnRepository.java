package io.yakable.core.session;

import java.util.List;
import java.util.Optional;

public interface TurnRepository {

    Turn save(Turn turn);

    Optional<Turn> findById(String turnId);

    List<Turn> findBySessionId(String sessionId);
}
