package io.yakable.dao.repository.impl;

import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.yakable.common.enums.session.TurnStatusEnum;
import io.yakable.dao.entity.TurnEntity;
import io.yakable.dao.mapper.TurnMapper;
import io.yakable.dao.repository.TurnRepository;
import jakarta.annotation.Resource;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@DependsOn("yakableFlyway")
public class TurnRepositoryImpl extends BaseRepositoryImpl<TurnMapper, TurnEntity> implements TurnRepository {

    @Resource
    private TurnMapper turnMapper;

    @Override
    protected TurnMapper mapper() {
        return turnMapper;
    }

    @Override
    public long queryActiveTurnCount(String sessionId) {
        return turnMapper.selectCount(
                Wrappers.<TurnEntity>lambdaQuery()
                        .eq(TurnEntity::getSessionId, sessionId)
                        .in(TurnEntity::getStatus, TurnStatusEnum.PENDING, TurnStatusEnum.RUNNING));
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
    public Optional<TurnEntity> updatePendingTurn(String turnId, LocalDateTime claimedAt) {
        LambdaUpdateWrapper<TurnEntity> update = Wrappers.<TurnEntity>lambdaUpdate()
                .eq(TurnEntity::getId, turnId)
                .eq(TurnEntity::getStatus, TurnStatusEnum.PENDING)
                .set(TurnEntity::getStatus, TurnStatusEnum.RUNNING)
                .setIncrBy(TurnEntity::getAttemptCount, 1)
                .set(TurnEntity::getStartedAt, claimedAt);
        return executeUpdate(update) == 0 ? Optional.empty() : queryById(turnId);
    }

    @Override
    public int updateTurnSucceeded(
            String turnId, String sessionId,
            Long inputTokens, Long outputTokens, Long totalTokens,
            String providerRequestId, String finishReason, LocalDateTime completedAt) {
        return executeUpdate(
                runningTurn(turnId, sessionId)
                        .set(TurnEntity::getStatus, TurnStatusEnum.SUCCEEDED)
                        .set(TurnEntity::getInputTokens, inputTokens)
                        .set(TurnEntity::getOutputTokens, outputTokens)
                        .set(TurnEntity::getTotalTokens, totalTokens)
                        .set(TurnEntity::getProviderRequestId, providerRequestId)
                        .set(TurnEntity::getFinishReason, finishReason)
                        .set(TurnEntity::getFinishedAt, completedAt));
    }

    @Override
    public int updateTurnFailed(String turnId, String sessionId, String errorMessage, LocalDateTime failedAt) {
        return executeUpdate(
                runningTurn(turnId, sessionId)
                        .set(TurnEntity::getStatus, TurnStatusEnum.FAILED)
                        .set(TurnEntity::getErrorMessage, errorMessage)
                        .set(TurnEntity::getFinishedAt, failedAt));
    }

    @Override
    public int updateTurnStopped(String turnId, String sessionId, LocalDateTime stoppedAt) {
        return executeUpdate(
                Wrappers.<TurnEntity>lambdaUpdate()
                        .eq(TurnEntity::getId, turnId)
                        .eq(TurnEntity::getSessionId, sessionId)
                        .in(TurnEntity::getStatus, TurnStatusEnum.PENDING, TurnStatusEnum.RUNNING)
                        .set(TurnEntity::getStatus, TurnStatusEnum.STOPPED)
                        .set(TurnEntity::getFinishedAt, stoppedAt));
    }

    @Override
    public int updateStaleTurnPending(LocalDateTime staleBefore) {
        return executeUpdate(
                resetToPending(
                        Wrappers.<TurnEntity>lambdaUpdate()
                                .eq(TurnEntity::getStatus, TurnStatusEnum.RUNNING)
                                .isNotNull(TurnEntity::getStartedAt)
                                .lt(TurnEntity::getStartedAt, staleBefore)));
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

    private LambdaUpdateWrapper<TurnEntity> runningTurn(String turnId, String sessionId) {
        return Wrappers.<TurnEntity>lambdaUpdate()
                .eq(TurnEntity::getId, turnId)
                .eq(TurnEntity::getSessionId, sessionId)
                .eq(TurnEntity::getStatus, TurnStatusEnum.RUNNING);
    }

    private LambdaUpdateWrapper<TurnEntity> resetToPending(LambdaUpdateWrapper<TurnEntity> update) {
        return update
                .set(TurnEntity::getStatus, TurnStatusEnum.PENDING)
                .set(TurnEntity::getErrorMessage, null)
                .set(TurnEntity::getInputTokens, null)
                .set(TurnEntity::getOutputTokens, null)
                .set(TurnEntity::getTotalTokens, null)
                .set(TurnEntity::getProviderRequestId, null)
                .set(TurnEntity::getFinishReason, null)
                .set(TurnEntity::getStartedAt, null)
                .set(TurnEntity::getFinishedAt, null);
    }

    private int executeUpdate(LambdaUpdateWrapper<TurnEntity> update) {
        return turnMapper.update(new TurnEntity(), update);
    }
}
