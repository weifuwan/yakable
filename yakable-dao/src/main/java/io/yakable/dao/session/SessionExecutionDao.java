package io.yakable.dao.session;

import io.yakable.dao.session.model.MessagePO;
import io.yakable.dao.session.model.TurnPO;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SessionExecutionDao {

    long countActiveTurns(String sessionId);

    int insertTurn(TurnPO turn);

    Optional<TurnPO> findTurnById(String turnId);

    List<TurnPO> findTurnsBySessionId(String sessionId);

    int claimPendingTurn(
            String turnId,
            Instant claimedAt,
            String provider,
            String model
    );

    int completeRunningTurn(
            String turnId,
            String sessionId,
            String provider,
            String model,
            Long inputTokens,
            Long outputTokens,
            Long totalTokens,
            String providerRequestId,
            String finishReason,
            Instant completedAt
    );

    int failRunningTurn(
            String turnId,
            String sessionId,
            String errorMessage,
            Instant failedAt
    );

    int recoverStaleRunningTurns(
            Instant staleBefore,
            Instant recoveredAt
    );

    List<String> findPendingTurnIds(int limit);

    long nextMessageSequence(String sessionId);

    int insertMessage(MessagePO message);

    List<MessagePO> findMessagesBySessionId(String sessionId);
}
