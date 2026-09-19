package io.yakable.dao.session;

import io.yakable.dao.session.model.MessagePO;
import io.yakable.domain.session.SessionBusyException;
import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.Turn;
import io.yakable.domain.session.TurnInvocation;
import io.yakable.domain.session.TurnStartResult;
import io.yakable.domain.session.TurnTokenUsage;
import io.yakable.domain.session.repository.SessionExecutionRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Repository
public class SessionExecutionRepositoryAdapter
        implements SessionExecutionRepository {

    private final SessionDao sessionDao;
    private final TurnDao turnDao;
    private final MessageDao messageDao;

    public SessionExecutionRepositoryAdapter(
            SessionDao sessionDao,
            TurnDao turnDao,
            MessageDao messageDao
    ) {
        this.sessionDao = Objects.requireNonNull(
                sessionDao,
                "sessionDao"
        );
        this.turnDao = Objects.requireNonNull(turnDao, "turnDao");
        this.messageDao = Objects.requireNonNull(
                messageDao,
                "messageDao"
        );
    }

    @Override
    @Transactional
    public TurnStartResult createPendingTurn(
            Turn turn,
            String userMessageId,
            String content,
            Instant createdAt
    ) {
        lockSession(turn.sessionId());

        if (turnDao.countActive(turn.sessionId()) > 0) {
            throw new SessionBusyException(turn.sessionId());
        }

        turnDao.insert(TurnPersistenceMapper.toPO(turn));

        long sequence = messageDao.nextSequence(turn.sessionId());
        SessionMessage userMessage = new SessionMessage(
                userMessageId,
                turn.sessionId(),
                turn.id(),
                SessionMessage.Role.USER,
                content,
                sequence,
                createdAt
        );
        messageDao.insert(toPO(userMessage));

        return new TurnStartResult(turn, userMessage);
    }

    @Override
    @Transactional
    public Optional<Turn> claimPendingTurn(
            String turnId,
            Instant claimedAt,
            String provider,
            String model
    ) {
        int updated = turnDao.claimPending(
                turnId,
                claimedAt,
                provider,
                model
        );
        if (updated == 0) {
            return Optional.empty();
        }

        return turnDao.findById(turnId)
                .map(TurnPersistenceMapper::toDomain);
    }

    @Override
    @Transactional
    public Turn completeTurn(
            Turn runningTurn,
            String assistantMessageId,
            String content,
            TurnInvocation completedInvocation,
            Instant completedAt
    ) {
        lockSession(runningTurn.sessionId());

        Turn succeeded = runningTurn.markSucceeded(
                completedAt,
                completedInvocation
        );

        TurnTokenUsage usage = completedInvocation.usage();
        int updated = turnDao.completeRunning(
                runningTurn.id(),
                runningTurn.sessionId(),
                completedInvocation.provider(),
                completedInvocation.model(),
                usage == null ? null : usage.inputTokens(),
                usage == null ? null : usage.outputTokens(),
                usage == null ? null : usage.totalTokens(),
                completedInvocation.providerRequestId(),
                completedInvocation.finishReason(),
                completedAt
        );
        if (updated != 1) {
            throw new IllegalStateException(
                    "Turn is no longer RUNNING: "
                            + runningTurn.id()
            );
        }

        long sequence = messageDao.nextSequence(
                runningTurn.sessionId()
        );
        SessionMessage assistantMessage = new SessionMessage(
                assistantMessageId,
                runningTurn.sessionId(),
                runningTurn.id(),
                SessionMessage.Role.ASSISTANT,
                content,
                sequence,
                completedAt
        );
        messageDao.insert(toPO(assistantMessage));

        return succeeded;
    }

    @Override
    @Transactional
    public Turn failTurn(
            Turn runningTurn,
            String errorMessage,
            Instant failedAt
    ) {
        Turn failed = runningTurn.markFailed(
                errorMessage,
                failedAt
        );

        int updated = turnDao.failRunning(
                runningTurn.id(),
                runningTurn.sessionId(),
                errorMessage,
                failedAt
        );
        if (updated != 1) {
            throw new IllegalStateException(
                    "Turn is no longer RUNNING: "
                            + runningTurn.id()
            );
        }

        return failed;
    }

    @Override
    @Transactional
    public int recoverStaleRunningTurns(
            Instant staleBefore,
            Instant recoveredAt
    ) {
        Objects.requireNonNull(staleBefore, "staleBefore");
        Objects.requireNonNull(recoveredAt, "recoveredAt");
        return turnDao.recoverStale(staleBefore, recoveredAt);
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> findPendingTurnIds(int limit) {
        return turnDao.findPendingIds(limit);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Turn> findTurnById(String turnId) {
        return turnDao.findById(turnId)
                .map(TurnPersistenceMapper::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Turn> findTurnsBySessionId(String sessionId) {
        return turnDao.findBySessionId(sessionId)
                .stream()
                .map(TurnPersistenceMapper::toDomain)
                .sorted(Comparator.comparing(Turn::createdAt))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<SessionMessage> findMessagesBySessionId(
            String sessionId
    ) {
        return messageDao.findBySessionId(sessionId)
                .stream()
                .map(SessionExecutionRepositoryAdapter::toDomain)
                .sorted(
                        Comparator.comparingLong(
                                SessionMessage::sequence
                        )
                )
                .toList();
    }

    private void lockSession(String sessionId) {
        if (sessionDao.lockById(sessionId).isEmpty()) {
            throw new IllegalStateException(
                    "Session does not exist: " + sessionId
            );
        }
    }

    private static MessagePO toPO(SessionMessage message) {
        MessagePO po = new MessagePO();
        po.setId(message.id());
        po.setSessionId(message.sessionId());
        po.setTurnId(message.turnId());
        po.setRole(message.role().name());
        po.setContent(message.content());
        po.setMessageSequence(message.sequence());
        po.setCreatedAt(message.createdAt());
        return po;
    }

    private static SessionMessage toDomain(MessagePO po) {
        return new SessionMessage(
                po.getId(),
                po.getSessionId(),
                po.getTurnId(),
                SessionMessage.Role.valueOf(po.getRole()),
                po.getContent(),
                po.getMessageSequence(),
                po.getCreatedAt()
        );
    }
}
