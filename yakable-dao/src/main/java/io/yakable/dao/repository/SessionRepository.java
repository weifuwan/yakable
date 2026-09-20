package io.yakable.dao.repository;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import io.yakable.common.constant.SystemConstant;
import io.yakable.common.enums.TurnStatusEnum;
import io.yakable.dao.entity.MessageEntity;
import io.yakable.dao.entity.SessionEntity;
import io.yakable.dao.entity.TurnEntity;
import io.yakable.dao.mapper.MessageMapper;
import io.yakable.dao.mapper.SessionMapper;
import io.yakable.dao.mapper.TurnMapper;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Repository
@DependsOn("yakableFlyway")
public class SessionRepository {

    private final SessionMapper sessionMapper;
    private final TurnMapper turnMapper;
    private final MessageMapper messageMapper;

    public SessionRepository(SessionMapper sessionMapper, TurnMapper turnMapper, MessageMapper messageMapper) {
        this.sessionMapper = Objects.requireNonNull(sessionMapper, "sessionMapper");
        this.turnMapper = Objects.requireNonNull(turnMapper, "turnMapper");
        this.messageMapper = Objects.requireNonNull(messageMapper, "messageMapper");
    }

    public SessionEntity saveSession(SessionEntity entity) {
        Objects.requireNonNull(entity, "entity");
        if (sessionMapper.selectById(entity.getId()) == null) {
            sessionMapper.insert(entity);
        } else {
            sessionMapper.updateById(entity);
        }
        return entity;
    }

    public Optional<SessionEntity> findSessionById(String sessionId) {
        return Optional.ofNullable(sessionMapper.selectById(sessionId));
    }

    public Optional<SessionEntity> findOwnedSession(String projectId, String sessionId) {
        return Optional.ofNullable(sessionMapper.selectOne(
                Wrappers.<SessionEntity>lambdaQuery()
                        .eq(SessionEntity::getId, sessionId)
                        .eq(SessionEntity::getProjectId, projectId)));
    }

    public boolean lockSession(String sessionId) {
        return sessionMapper.selectOne(
                Wrappers.<SessionEntity>lambdaQuery()
                        .eq(SessionEntity::getId, sessionId)
                        .last("FOR UPDATE")) != null;
    }

    public long countActiveTurns(String sessionId) {
        return turnMapper.selectCount(
                Wrappers.<TurnEntity>lambdaQuery()
                        .eq(TurnEntity::getSessionId, sessionId)
                        .in(TurnEntity::getStatus,
                                TurnStatusEnum.PENDING,
                                TurnStatusEnum.RUNNING));
    }

    public int insertTurn(TurnEntity entity) {
        return turnMapper.insert(entity);
    }

    public int insertMessage(MessageEntity entity) {
        return messageMapper.insert(entity);
    }

    public long nextMessageSequence(String sessionId) {
        MessageEntity latest = messageMapper.selectOne(
                Wrappers.<MessageEntity>lambdaQuery()
                        .select(MessageEntity::getMessageSequence)
                        .eq(MessageEntity::getSessionId, sessionId)
                        .orderByDesc(MessageEntity::getMessageSequence)
                        .last("LIMIT 1"));
        return latest == null || latest.getMessageSequence() == null ? 1L : latest.getMessageSequence() + 1L;
    }

    public long latestMessageSequence(String sessionId) {
        return Math.max(0L, nextMessageSequence(sessionId) - 1L);
    }

    public Optional<TurnEntity> findTurnById(String turnId) {
        return Optional.ofNullable(turnMapper.selectById(turnId));
    }

    public List<TurnEntity> findTurnsBySessionId(String sessionId) {
        return turnMapper.selectList(
                Wrappers.<TurnEntity>lambdaQuery()
                        .eq(TurnEntity::getSessionId, sessionId)
                        .orderByAsc(TurnEntity::getCreateTime, TurnEntity::getId));
    }

    public Optional<TurnEntity> findLatestTurn(String sessionId) {
        return Optional.ofNullable(turnMapper.selectOne(
                Wrappers.<TurnEntity>lambdaQuery()
                        .eq(TurnEntity::getSessionId, sessionId)
                        .orderByDesc(TurnEntity::getCreateTime, TurnEntity::getId)
                        .last("LIMIT 1")));
    }

    public List<MessageEntity> findMessagesBySessionId(String sessionId) {
        return messageMapper.selectList(
                Wrappers.<MessageEntity>lambdaQuery()
                        .eq(MessageEntity::getSessionId, sessionId)
                        .orderByAsc(MessageEntity::getMessageSequence));
    }

    public List<MessageEntity> findMessagesAfter(String sessionId, long afterSequence) {
        return messageMapper.selectList(
                Wrappers.<MessageEntity>lambdaQuery()
                        .eq(MessageEntity::getSessionId, sessionId)
                        .gt(MessageEntity::getMessageSequence, afterSequence)
                        .orderByAsc(MessageEntity::getMessageSequence));
    }

    public List<MessageEntity> findMessagesBefore(String sessionId, Long beforeSequence, int limit) {
        if (limit <= 0) {
            return List.of();
        }

        var query = Wrappers.<MessageEntity>lambdaQuery().eq(MessageEntity::getSessionId, sessionId);
        if (beforeSequence != null) {
            query.lt(MessageEntity::getMessageSequence, beforeSequence);
        }
        query.orderByDesc(MessageEntity::getMessageSequence).last("LIMIT " + limit);
        return messageMapper.selectList(query);
    }

    public Optional<TurnEntity> claimPendingTurn(
            String turnId, LocalDateTime claimedAt, String provider, String model) {
        int updated = turnMapper.update(
                null,
                Wrappers.<TurnEntity>lambdaUpdate()
                        .eq(TurnEntity::getId, turnId)
                        .eq(TurnEntity::getStatus, TurnStatusEnum.PENDING)
                        .set(TurnEntity::getStatus, TurnStatusEnum.RUNNING)
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
                        .set(TurnEntity::getUpdateTime, claimedAt)
                        .set(TurnEntity::getUpdateBy, SystemConstant.SYSTEM_USER));
        return updated == 0 ? Optional.empty() : Optional.ofNullable(turnMapper.selectById(turnId));
    }

    public int completeRunningTurn(
            String turnId, String sessionId, String provider, String model,
            Long inputTokens, Long outputTokens, Long totalTokens,
            String providerRequestId, String finishReason, LocalDateTime completedAt) {
        return turnMapper.update(
                null,
                Wrappers.<TurnEntity>lambdaUpdate()
                        .eq(TurnEntity::getId, turnId)
                        .eq(TurnEntity::getSessionId, sessionId)
                        .eq(TurnEntity::getStatus, TurnStatusEnum.RUNNING)
                        .set(TurnEntity::getStatus, TurnStatusEnum.SUCCEEDED)
                        .set(TurnEntity::getErrorMessage, null)
                        .set(TurnEntity::getProvider, provider)
                        .set(TurnEntity::getModel, model)
                        .set(TurnEntity::getInputTokens, inputTokens)
                        .set(TurnEntity::getOutputTokens, outputTokens)
                        .set(TurnEntity::getTotalTokens, totalTokens)
                        .set(TurnEntity::getProviderRequestId, providerRequestId)
                        .set(TurnEntity::getFinishReason, finishReason)
                        .set(TurnEntity::getFinishedAt, completedAt)
                        .set(TurnEntity::getUpdateTime, completedAt)
                        .set(TurnEntity::getUpdateBy, SystemConstant.SYSTEM_USER));
    }

    public int failRunningTurn(String turnId, String sessionId, String errorMessage, LocalDateTime failedAt) {
        return turnMapper.update(
                null,
                Wrappers.<TurnEntity>lambdaUpdate()
                        .eq(TurnEntity::getId, turnId)
                        .eq(TurnEntity::getSessionId, sessionId)
                        .eq(TurnEntity::getStatus, TurnStatusEnum.RUNNING)
                        .set(TurnEntity::getStatus, TurnStatusEnum.FAILED)
                        .set(TurnEntity::getErrorMessage, errorMessage)
                        .set(TurnEntity::getFinishedAt, failedAt)
                        .set(TurnEntity::getUpdateTime, failedAt)
                        .set(TurnEntity::getUpdateBy, SystemConstant.SYSTEM_USER));
    }

    public int recoverStaleRunningTurns(LocalDateTime staleBefore, LocalDateTime recoveredAt) {
        return turnMapper.update(
                null,
                Wrappers.<TurnEntity>lambdaUpdate()
                        .eq(TurnEntity::getStatus, TurnStatusEnum.RUNNING)
                        .isNotNull(TurnEntity::getStartedAt)
                        .lt(TurnEntity::getStartedAt, staleBefore)
                        .set(TurnEntity::getStatus, TurnStatusEnum.PENDING)
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
                        .set(TurnEntity::getUpdateTime, recoveredAt)
                        .set(TurnEntity::getUpdateBy, SystemConstant.SYSTEM_USER));
    }

    public List<String> findPendingTurnIds(int limit) {
        if (limit <= 0) {
            return List.of();
        }
        return turnMapper.selectList(
                        Wrappers.<TurnEntity>lambdaQuery()
                                .select(TurnEntity::getId)
                                .eq(TurnEntity::getStatus, TurnStatusEnum.PENDING)
                                .orderByAsc(TurnEntity::getCreateTime, TurnEntity::getId)
                                .last("LIMIT " + limit))
                .stream()
                .map(TurnEntity::getId)
                .toList();
    }
}
