package io.yakable.dao.session;

import io.yakable.dao.session.model.MessagePO;
import io.yakable.dao.session.model.TurnPO;
import io.yakable.domain.session.SessionBusyException;
import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.Turn;
import io.yakable.domain.session.TurnStartResult;
import io.yakable.domain.session.TurnStatus;
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
    private final SessionExecutionDao executionDao;

    public SessionExecutionRepositoryAdapter(
            SessionDao sessionDao,
            SessionExecutionDao executionDao
    ) {
        this.sessionDao = Objects.requireNonNull(
                sessionDao,
                "sessionDao"
        );
        this.executionDao = Objects.requireNonNull(
                executionDao,
                "executionDao"
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

        if (executionDao.countActiveTurns(turn.sessionId()) > 0) {
            throw new SessionBusyException(turn.sessionId());
        }

        executionDao.insertTurn(toPO(turn));

        long sequence = executionDao.nextMessageSequence(
                turn.sessionId()
        );
        SessionMessage userMessage = new SessionMessage(
                userMessageId,
                turn.sessionId(),
                turn.id(),
                SessionMessage.Role.USER,
                content,
                sequence,
                createdAt
        );
        executionDao.insertMessage(toPO(userMessage));

        return new TurnStartResult(turn, userMessage);
    }

    @Override
    @Transactional
    public Optional<Turn> claimPendingTurn(
            String turnId,
            Instant claimedAt
    ) {
        int updated = executionDao.claimPendingTurn(
                turnId,
                claimedAt
        );
        if (updated == 0) {
            return Optional.empty();
        }

        return executionDao.findTurnById(turnId)
                .map(SessionExecutionRepositoryAdapter::toDomain);
    }

    @Override
    @Transactional
    public Turn completeTurn(
            Turn runningTurn,
            String assistantMessageId,
            String content,
            Instant completedAt
    ) {
        lockSession(runningTurn.sessionId());

        Turn succeeded = runningTurn.markSucceeded(completedAt);
        int updated = executionDao.completeRunningTurn(
                runningTurn.id(),
                runningTurn.sessionId(),
                completedAt
        );
        if (updated != 1) {
            throw new IllegalStateException(
                    "Turn is no longer RUNNING: "
                            + runningTurn.id()
            );
        }

        long sequence = executionDao.nextMessageSequence(
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
        executionDao.insertMessage(toPO(assistantMessage));

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

        int updated = executionDao.failRunningTurn(
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
        return executionDao.recoverStaleRunningTurns(
                staleBefore,
                recoveredAt
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> findPendingTurnIds(int limit) {
        return executionDao.findPendingTurnIds(limit);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Turn> findTurnById(String turnId) {
        return executionDao.findTurnById(turnId)
                .map(SessionExecutionRepositoryAdapter::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Turn> findTurnsBySessionId(String sessionId) {
        return executionDao.findTurnsBySessionId(sessionId)
                .stream()
                .map(SessionExecutionRepositoryAdapter::toDomain)
                .sorted(Comparator.comparing(Turn::createdAt))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<SessionMessage> findMessagesBySessionId(
            String sessionId
    ) {
        return executionDao.findMessagesBySessionId(sessionId)
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

    private static TurnPO toPO(Turn turn) {
        TurnPO po = new TurnPO();
        po.setId(turn.id());
        po.setSessionId(turn.sessionId());
        po.setStatus(turn.status().name());
        po.setAttemptCount(turn.attemptCount());
        po.setErrorMessage(turn.errorMessage());
        po.setStartedAt(turn.startedAt());
        po.setFinishedAt(turn.finishedAt());
        po.setCreatedAt(turn.createdAt());
        po.setUpdatedAt(turn.updatedAt());
        return po;
    }

    private static Turn toDomain(TurnPO po) {
        return new Turn(
                po.getId(),
                po.getSessionId(),
                TurnStatus.valueOf(po.getStatus()),
                po.getAttemptCount() == null
                        ? 0
                        : po.getAttemptCount(),
                po.getErrorMessage(),
                po.getStartedAt(),
                po.getFinishedAt(),
                po.getCreatedAt(),
                po.getUpdatedAt()
        );
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
