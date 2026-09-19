package io.yakable.domain.session.repository;

import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.Turn;
import io.yakable.domain.session.TurnInvocation;
import io.yakable.domain.session.TurnStartResult;

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
            Instant claimedAt,
            String provider,
            String model
    );

    Turn completeTurn(
            Turn runningTurn,
            String assistantMessageId,
            String content,
            TurnInvocation completedInvocation,
            Instant completedAt
    );

    Turn failTurn(
            Turn runningTurn,
            String errorMessage,
            Instant failedAt
    );

    int recoverStaleRunningTurns(
            Instant staleBefore,
            Instant recoveredAt
    );

    List<String> findPendingTurnIds(int limit);

    Optional<Turn> findTurnById(String turnId);

    List<Turn> findTurnsBySessionId(String sessionId);

    List<SessionMessage> findMessagesBySessionId(String sessionId);
}
