package io.yakable.dao.repository.impl;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import io.yakable.common.constant.SystemConstant;
import io.yakable.common.enums.session.TurnStatusEnum;
import io.yakable.dao.entity.MessageEntity;
import io.yakable.dao.entity.SessionEntity;
import io.yakable.dao.entity.TurnEntity;
import io.yakable.dao.mapper.MessageMapper;
import io.yakable.dao.mapper.SessionMapper;
import io.yakable.dao.mapper.TurnMapper;
import io.yakable.dao.repository.SessionRepository;
import jakarta.annotation.Resource;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@DependsOn("yakableFlyway")
public class SessionRepositoryImpl extends BaseRepositoryImpl<SessionMapper, SessionEntity> implements SessionRepository {

    @Resource
    private SessionMapper sessionMapper;

    @Resource
    private TurnMapper turnMapper;

    @Resource
    private MessageMapper messageMapper;

    @Override
    protected SessionMapper mapper() {
        return sessionMapper;
    }

    @Override
    public Optional<SessionEntity> querySession(String projectId, String sessionId) {
        return Optional.ofNullable(sessionMapper.selectOne(
                Wrappers.<SessionEntity>lambdaQuery()
                        .eq(SessionEntity::getId, sessionId)
                        .eq(SessionEntity::getProjectId, projectId)));
    }

    @Override
    public boolean querySessionForUpdate(String sessionId) {
        return sessionMapper.selectOne(
                Wrappers.<SessionEntity>lambdaQuery()
                        .eq(SessionEntity::getId, sessionId)
                        .last("FOR UPDATE")) != null;
    }

    @Override
    public long queryActiveTurnCount(String sessionId) {
        return turnMapper.selectCount(
                Wrappers.<TurnEntity>lambdaQuery()
                        .eq(TurnEntity::getSessionId, sessionId)
                        .in(TurnEntity::getStatus, TurnStatusEnum.PENDING, TurnStatusEnum.RUNNING));
    }

    @Override
    public int addTurn(TurnEntity entity) {
        return turnMapper.insert(entity);
    }

    @Override
    public int addMessage(MessageEntity entity) {
        return messageMapper.insert(entity);
    }

    @Override
    public long queryNextMessageSequence(String sessionId) {
        Page<MessageEntity> page = new Page<>(1, 1, false);
        MessageEntity latest = messageMapper.selectPage(
                        page,
                        Wrappers.<MessageEntity>lambdaQuery()
                                .select(MessageEntity::getMessageSequence)
                                .eq(MessageEntity::getSessionId, sessionId)
                                .orderByDesc(MessageEntity::getMessageSequence))
                .getRecords()
                .stream()
                .findFirst()
                .orElse(null);
        return latest == null || latest.getMessageSequence() == null ? 1L : latest.getMessageSequence() + 1L;
    }

    @Override
    public long queryLatestMessageSequence(String sessionId) {
        return Math.max(0L, queryNextMessageSequence(sessionId) - 1L);
    }

    @Override
    public Optional<TurnEntity> queryTurn(String turnId) {
        return Optional.ofNullable(turnMapper.selectById(turnId));
    }

    @Override
    public List<TurnEntity> queryTurnList(String sessionId) {
        return turnMapper.selectList(
                Wrappers.<TurnEntity>lambdaQuery()
                        .eq(TurnEntity::getSessionId, sessionId)
                        .orderByAsc(TurnEntity::getCreateTime, TurnEntity::getId));
    }

    @Override
    public Optional<TurnEntity> queryLatestTurn(String sessionId) {
        Page<TurnEntity> page = new Page<>(1, 1, false);
        return turnMapper.selectPage(
                        page,
                        Wrappers.<TurnEntity>lambdaQuery()
                                .eq(TurnEntity::getSessionId, sessionId)
                                .orderByDesc(TurnEntity::getCreateTime, TurnEntity::getId))
                .getRecords()
                .stream()
                .findFirst();
    }

    @Override
    public List<MessageEntity> queryMessageList(String sessionId) {
        return messageMapper.selectList(
                Wrappers.<MessageEntity>lambdaQuery()
                        .eq(MessageEntity::getSessionId, sessionId)
                        .orderByAsc(MessageEntity::getMessageSequence));
    }

    @Override
    public List<MessageEntity> queryMessageAfter(String sessionId, long afterSequence) {
        return messageMapper.selectList(
                Wrappers.<MessageEntity>lambdaQuery()
                        .eq(MessageEntity::getSessionId, sessionId)
                        .gt(MessageEntity::getMessageSequence, afterSequence)
                        .orderByAsc(MessageEntity::getMessageSequence));
    }

    @Override
    public List<MessageEntity> queryMessageBefore(String sessionId, Long beforeSequence, int limit) {
        var query = Wrappers.<MessageEntity>lambdaQuery().eq(MessageEntity::getSessionId, sessionId);
        if (beforeSequence != null) {
            query.lt(MessageEntity::getMessageSequence, beforeSequence);
        }
        query.orderByDesc(MessageEntity::getMessageSequence);

        Page<MessageEntity> page = new Page<>(1, limit, false);
        return messageMapper.selectPage(page, query).getRecords();
    }

    @Override
    public Optional<TurnEntity> updatePendingTurn(String turnId, LocalDateTime claimedAt, String provider, String model) {
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

    @Override
    public int updateTurnSucceeded(
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

    @Override
    public int updateTurnFailed(String turnId, String sessionId, String errorMessage, LocalDateTime failedAt) {
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

    @Override
    public int updateStaleTurnPending(LocalDateTime staleBefore, LocalDateTime recoveredAt) {
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

    @Override
    public List<String> queryPendingTurnIdList(int limit) {
        Page<TurnEntity> page = new Page<>(1, limit, false);
        return turnMapper.selectPage(
                        page,
                        Wrappers.<TurnEntity>lambdaQuery()
                                .select(TurnEntity::getId)
                                .eq(TurnEntity::getStatus, TurnStatusEnum.PENDING)
                                .orderByAsc(TurnEntity::getCreateTime, TurnEntity::getId))
                .getRecords()
                .stream()
                .map(TurnEntity::getId)
                .toList();
    }
}
