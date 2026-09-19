package io.yakable.dao.session;

import io.yakable.dao.session.model.MessagePO;
import io.yakable.dao.session.model.SessionPO;
import io.yakable.dao.session.model.TurnPO;

import java.util.List;
import java.util.Optional;

public interface SessionQueryDao {

    Optional<SessionPO> findOwnedSession(
            String projectId,
            String sessionId
    );

    List<TurnPO> findTurns(String sessionId);

    Optional<TurnPO> findLatestTurn(String sessionId);

    List<MessagePO> findMessages(String sessionId);

    List<MessagePO> findMessagesAfter(
            String sessionId,
            long afterSequence
    );

    List<MessagePO> findMessagesBefore(
            String sessionId,
            Long beforeSequence,
            int limit
    );

    long latestMessageSequence(String sessionId);
}
