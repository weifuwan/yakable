package io.yakable.dao.session;

import io.yakable.dao.session.mapper.MessageQueryMapper;
import io.yakable.dao.session.mapper.SessionQueryMapper;
import io.yakable.dao.session.mapper.TurnQueryMapper;
import io.yakable.dao.session.model.MessagePO;
import io.yakable.dao.session.model.SessionPO;
import io.yakable.dao.session.model.TurnPO;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Repository
@DependsOn("yakableFlyway")
public class MybatisSessionQueryDao
        implements SessionQueryDao {

    private final SessionQueryMapper sessionMapper;
    private final TurnQueryMapper turnMapper;
    private final MessageQueryMapper messageMapper;

    public MybatisSessionQueryDao(
            SessionQueryMapper sessionMapper,
            TurnQueryMapper turnMapper,
            MessageQueryMapper messageMapper
    ) {
        this.sessionMapper = Objects.requireNonNull(
                sessionMapper,
                "sessionMapper"
        );
        this.turnMapper = Objects.requireNonNull(
                turnMapper,
                "turnMapper"
        );
        this.messageMapper = Objects.requireNonNull(
                messageMapper,
                "messageMapper"
        );
    }

    @Override
    public Optional<SessionPO> findOwnedSession(
            String projectId,
            String sessionId
    ) {
        return Optional.ofNullable(
                sessionMapper.selectOwnedSession(
                        projectId,
                        sessionId
                )
        );
    }

    @Override
    public List<TurnPO> findTurns(String sessionId) {
        return turnMapper.selectSessionTurns(sessionId);
    }

    @Override
    public Optional<TurnPO> findLatestTurn(String sessionId) {
        return Optional.ofNullable(
                turnMapper.selectLatestTurn(sessionId)
        );
    }

    @Override
    public List<MessagePO> findMessages(String sessionId) {
        return messageMapper.selectSessionMessages(sessionId);
    }

    @Override
    public List<MessagePO> findMessagesAfter(
            String sessionId,
            long afterSequence
    ) {
        return messageMapper.selectMessagesAfter(
                sessionId,
                afterSequence
        );
    }

    @Override
    public List<MessagePO> findMessagesBefore(
            String sessionId,
            Long beforeSequence,
            int limit
    ) {
        if (beforeSequence == null) {
            return messageMapper.selectLatestMessages(
                    sessionId,
                    limit
            );
        }

        return messageMapper.selectMessagesBefore(
                sessionId,
                beforeSequence,
                limit
        );
    }

    @Override
    public long latestMessageSequence(String sessionId) {
        return messageMapper.selectLatestSequence(sessionId);
    }
}
