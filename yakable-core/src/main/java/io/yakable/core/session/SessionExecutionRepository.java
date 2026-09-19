package io.yakable.core.session;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SessionExecutionRepository {

    TurnStartResult createPendingTurn(
            Turn turn,
            String userMessageId,
            String content,
            Instant createdAt
    );

    Optional<Turn> claimPendingTurn(
            String turnId,
            Instant claimedAt
    );

    Turn completeTurn(
            Turn runningTurn,
            String assistantMessageId,
            String content,
            Instant completedAt
    );

    Turn failTurn(
            Turn runningTurn,
            String errorMessage,
            Instant failedAt
    );

    Optional<Turn> findTurnById(String turnId);

    List<Turn> findTurnsBySessionId(String sessionId);

    List<SessionMessage> findMessagesBySessionId(String sessionId);
}
