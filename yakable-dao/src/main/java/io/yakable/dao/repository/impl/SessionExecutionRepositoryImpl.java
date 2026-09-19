package io.yakable.dao.repository.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import io.yakable.dao.entity.MessageEntity;
import io.yakable.dao.entity.SessionEntity;
import io.yakable.dao.entity.TurnEntity;
import io.yakable.dao.mapper.MessageMapper;
import io.yakable.dao.mapper.SessionMapper;
import io.yakable.dao.mapper.TurnMapper;
import io.yakable.domain.session.SessionBusyException;
import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.Turn;
import io.yakable.domain.session.TurnInvocation;
import io.yakable.domain.session.TurnStartResult;
import io.yakable.domain.session.TurnStatus;
import io.yakable.domain.session.TurnTokenUsage;
import io.yakable.domain.session.repository.SessionExecutionRepository;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Repository
@DependsOn("yakableFlyway")
public class SessionExecutionRepositoryImpl
        implements SessionExecutionRepository {

    private final SessionMapper sessionMapper;
    private final TurnMapper turnMapper;
    private final MessageMapper messageMapper;

    public SessionExecutionRepositoryImpl(
            SessionMapper sessionMapper,
            TurnMapper turnMapper,
            MessageMapper messageMapper
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
    @Transactional
    public TurnStartResult createPendingTurn(
            Turn turn,
            String userMessageId,
            String content,
            Instant createdAt
    ) {
        lockSession(turn.sessionId());

        if (countActiveTurns(turn.sessionId()) > 0) {
            throw new SessionBusyException(turn.sessionId());
        }

        turnMapper.insert(toTurnEntity(turn));

        long sequence = nextMessageSequence(turn.sessionId());
        SessionMessage userMessage = new SessionMessage(
                userMessageId,
                turn.sessionId(),
                turn.id(),
                SessionMessage.Role.USER,
                content,
                sequence,
                createdAt
        );
        messageMapper.insert(toMessageEntity(userMessage));

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
        int updated = turnMapper.update(
                null,
                Wrappers.<TurnEntity>lambdaUpdate()
                        .eq(TurnEntity::getId, turnId)
                        .eq(TurnEntity::getStatus, "PENDING")
                        .set(TurnEntity::getStatus, "RUNNING")
                        .setSql("attempt_count = attempt_count + 1")
                        .set(TurnEntity::getErrorMessage, null)
                        .set(TurnEntity::getProvider, provider)
                        .set(TurnEntity::getModel, model)
                        .set(TurnEntity::getInputTokens, null)
                        .set(TurnEntity::getOutputTokens, null)
                        .set(TurnEntity::getTotalTokens, null)
                        .set(TurnEntity::getProviderRequestId, null)
                        .set(TurnEntity::getFinishReason, null)
                        .set(TurnEntity::getStartedAt, claimedAt)
                        .set(TurnEntity::getFinishedAt, null)
                        .set(TurnEntity::getUpdatedAt, claimedAt)
        );
        if (updated == 0) {
            return Optional.empty();
        }

        return Optional.ofNullable(turnMapper.selectById(turnId))
                .map(SessionExecutionRepositoryImpl::toTurnDomain);
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

        int updated = turnMapper.update(
                null,
                Wrappers.<TurnEntity>lambdaUpdate()
                        .eq(TurnEntity::getId, runningTurn.id())
                        .eq(
                                TurnEntity::getSessionId,
                                runningTurn.sessionId()
                        )
                        .eq(TurnEntity::getStatus, "RUNNING")
                        .set(TurnEntity::getStatus, "SUCCEEDED")
                        .set(TurnEntity::getErrorMessage, null)
                        .set(
                                TurnEntity::getProvider,
                                completedInvocation.provider()
                        )
                        .set(
                                TurnEntity::getModel,
                                completedInvocation.model()
                        )
                        .set(
                                TurnEntity::getInputTokens,
                                usage == null ? null : usage.inputTokens()
                        )
                        .set(
                                TurnEntity::getOutputTokens,
                                usage == null ? null : usage.outputTokens()
                        )
                        .set(
                                TurnEntity::getTotalTokens,
                                usage == null ? null : usage.totalTokens()
                        )
                        .set(
                                TurnEntity::getProviderRequestId,
                                completedInvocation.providerRequestId()
                        )
                        .set(
                                TurnEntity::getFinishReason,
                                completedInvocation.finishReason()
                        )
                        .set(TurnEntity::getFinishedAt, completedAt)
                        .set(TurnEntity::getUpdatedAt, completedAt)
        );
        if (updated != 1) {
            throw new IllegalStateException(
                    "Turn is no longer RUNNING: "
                            + runningTurn.id()
            );
        }

        long sequence = nextMessageSequence(
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
        messageMapper.insert(toMessageEntity(assistantMessage));

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

        int updated = turnMapper.update(
                null,
                Wrappers.<TurnEntity>lambdaUpdate()
                        .eq(TurnEntity::getId, runningTurn.id())
                        .eq(
                                TurnEntity::getSessionId,
                                runningTurn.sessionId()
                        )
                        .eq(TurnEntity::getStatus, "RUNNING")
                        .set(TurnEntity::getStatus, "FAILED")
                        .set(
                                TurnEntity::getErrorMessage,
                                errorMessage
                        )
                        .set(TurnEntity::getFinishedAt, failedAt)
                        .set(TurnEntity::getUpdatedAt, failedAt)
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

        return turnMapper.update(
                null,
                Wrappers.<TurnEntity>lambdaUpdate()
                        .eq(TurnEntity::getStatus, "RUNNING")
                        .isNotNull(TurnEntity::getStartedAt)
                        .lt(TurnEntity::getStartedAt, staleBefore)
                        .set(TurnEntity::getStatus, "PENDING")
                        .set(TurnEntity::getErrorMessage, null)
                        .set(TurnEntity::getProvider, null)
                        .set(TurnEntity::getModel, null)
                        .set(TurnEntity::getInputTokens, null)
                        .set(TurnEntity::getOutputTokens, null)
                        .set(TurnEntity::getTotalTokens, null)
                        .set(TurnEntity::getProviderRequestId, null)
                        .set(TurnEntity::getFinishReason, null)
                        .set(TurnEntity::getStartedAt, null)
                        .set(TurnEntity::getFinishedAt, null)
                        .set(TurnEntity::getUpdatedAt, recoveredAt)
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> findPendingTurnIds(int limit) {
        if (limit <= 0) {
            return List.of();
        }
        return turnMapper.selectList(
                        Wrappers.<TurnEntity>lambdaQuery()
                                .select(TurnEntity::getId)
                                .eq(TurnEntity::getStatus, "PENDING")
                                .orderByAsc(
                                        TurnEntity::getCreatedAt,
                                        TurnEntity::getId
                                )
                                .last("LIMIT " + limit)
                )
                .stream()
                .map(TurnEntity::getId)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Turn> findTurnById(String turnId) {
        return Optional.ofNullable(turnMapper.selectById(turnId))
                .map(SessionExecutionRepositoryImpl::toTurnDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Turn> findTurnsBySessionId(String sessionId) {
        return turnMapper.selectList(
                        Wrappers.<TurnEntity>lambdaQuery()
                                .eq(TurnEntity::getSessionId, sessionId)
                                .orderByAsc(
                                        TurnEntity::getCreatedAt,
                                        TurnEntity::getId
                                )
                )
                .stream()
                .map(SessionExecutionRepositoryImpl::toTurnDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<SessionMessage> findMessagesBySessionId(
            String sessionId
    ) {
        return messageMapper.selectList(
                        Wrappers.<MessageEntity>lambdaQuery()
                                .eq(
                                        MessageEntity::getSessionId,
                                        sessionId
                                )
                                .orderByAsc(
                                        MessageEntity::getMessageSequence
                                )
                )
                .stream()
                .map(SessionExecutionRepositoryImpl::toMessageDomain)
                .toList();
    }

    private void lockSession(String sessionId) {
        SessionEntity session = sessionMapper.selectOne(
                Wrappers.<SessionEntity>lambdaQuery()
                        .eq(SessionEntity::getId, sessionId)
                        .last("FOR UPDATE")
        );
        if (session == null) {
            throw new IllegalStateException(
                    "Session does not exist: " + sessionId
            );
        }
    }

    private long countActiveTurns(String sessionId) {
        return turnMapper.selectCount(
                Wrappers.<TurnEntity>lambdaQuery()
                        .eq(TurnEntity::getSessionId, sessionId)
                        .in(
                                TurnEntity::getStatus,
                                "PENDING",
                                "RUNNING"
                        )
        );
    }

    private long nextMessageSequence(String sessionId) {
        MessageEntity latest = messageMapper.selectOne(
                Wrappers.<MessageEntity>lambdaQuery()
                        .select(MessageEntity::getMessageSequence)
                        .eq(MessageEntity::getSessionId, sessionId)
                        .orderByDesc(MessageEntity::getMessageSequence)
                        .last("LIMIT 1")
        );
        return latest == null
                || latest.getMessageSequence() == null
                ? 1L
                : latest.getMessageSequence() + 1L;
    }

    private static TurnEntity toTurnEntity(Turn turn) {
        TurnEntity entity = new TurnEntity();
        entity.setId(turn.id());
        entity.setSessionId(turn.sessionId());
        entity.setStatus(turn.status().name());
        entity.setAttemptCount(turn.attemptCount());
        entity.setErrorMessage(turn.errorMessage());

        TurnInvocation invocation = turn.invocation();
        if (invocation != null) {
            entity.setProvider(invocation.provider());
            entity.setModel(invocation.model());

            TurnTokenUsage usage = invocation.usage();
            if (usage != null) {
                entity.setInputTokens(usage.inputTokens());
                entity.setOutputTokens(usage.outputTokens());
                entity.setTotalTokens(usage.totalTokens());
            }

            entity.setProviderRequestId(
                    invocation.providerRequestId()
            );
            entity.setFinishReason(invocation.finishReason());
        }

        entity.setStartedAt(turn.startedAt());
        entity.setFinishedAt(turn.finishedAt());
        entity.setCreatedAt(turn.createdAt());
        entity.setUpdatedAt(turn.updatedAt());
        return entity;
    }

    private static Turn toTurnDomain(TurnEntity entity) {
        return new Turn(
                entity.getId(),
                entity.getSessionId(),
                TurnStatus.valueOf(entity.getStatus()),
                entity.getAttemptCount() == null
                        ? 0
                        : entity.getAttemptCount(),
                entity.getErrorMessage(),
                toInvocation(entity),
                entity.getStartedAt(),
                entity.getFinishedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private static TurnInvocation toInvocation(
            TurnEntity entity
    ) {
        String provider = entity.getProvider();
        String model = entity.getModel();

        if (provider == null && model == null) {
            return null;
        }
        if (provider == null || model == null) {
            throw new IllegalStateException(
                    "Turn invocation route is incomplete: "
                            + entity.getId()
            );
        }

        TurnTokenUsage usage = null;
        if (entity.getInputTokens() != null
                || entity.getOutputTokens() != null
                || entity.getTotalTokens() != null) {
            usage = new TurnTokenUsage(
                    entity.getInputTokens(),
                    entity.getOutputTokens(),
                    entity.getTotalTokens()
            );
        }

        return new TurnInvocation(
                provider,
                model,
                usage,
                entity.getProviderRequestId(),
                entity.getFinishReason()
        );
    }

    private static MessageEntity toMessageEntity(
            SessionMessage message
    ) {
        MessageEntity entity = new MessageEntity();
        entity.setId(message.id());
        entity.setSessionId(message.sessionId());
        entity.setTurnId(message.turnId());
        entity.setRole(message.role().name());
        entity.setContent(message.content());
        entity.setMessageSequence(message.sequence());
        entity.setCreatedAt(message.createdAt());
        return entity;
    }

    private static SessionMessage toMessageDomain(
            MessageEntity entity
    ) {
        return new SessionMessage(
                entity.getId(),
                entity.getSessionId(),
                entity.getTurnId(),
                SessionMessage.Role.valueOf(entity.getRole()),
                entity.getContent(),
                entity.getMessageSequence(),
                entity.getCreatedAt()
        );
    }
}
