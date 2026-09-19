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

    int claimPendingTurn(String turnId, Instant claimedAt);

    int completeRunningTurn(
            String turnId,
            String sessionId,
            Instant completedAt
    );

    int failRunningTurn(
            String turnId,
            String sessionId,
            String errorMessage,
            Instant failedAt
    );

    long nextMessageSequence(String sessionId);

    int insertMessage(MessagePO message);

    List<MessagePO> findMessagesBySessionId(String sessionId);
}
