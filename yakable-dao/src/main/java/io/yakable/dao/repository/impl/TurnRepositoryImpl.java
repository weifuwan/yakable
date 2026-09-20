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
    public Optional<TurnEntity> updatePendingTurn(String turnId, LocalDateTime claimedAt, String provider, String model) {
        LambdaUpdateWrapper<TurnEntity> update = clearResult(
                Wrappers.<TurnEntity>lambdaUpdate()
                        .eq(TurnEntity::getId, turnId)
                        .eq(TurnEntity::getStatus, TurnStatusEnum.PENDING)
                        .set(TurnEntity::getStatus, TurnStatusEnum.RUNNING)
                        .setIncrBy(TurnEntity::getAttemptCount, 1)
                        .set(TurnEntity::getProvider, provider)
                        .set(TurnEntity::getModel, model)
                        .set(TurnEntity::getStartedAt, claimedAt));
        return executeUpdate(update) == 0 ? Optional.empty() : Optional.ofNullable(turnMapper.selectById(turnId));
    }

    @Override
    public int updateTurnSucceeded(
            String turnId, String sessionId, String provider, String model,
            Long inputTokens, Long outputTokens, Long totalTokens,
            String providerRequestId, String finishReason, LocalDateTime completedAt) {
        return executeUpdate(
                runningTurn(turnId, sessionId)
                        .set(TurnEntity::getStatus, TurnStatusEnum.SUCCEEDED)
                        .set(TurnEntity::getErrorMessage, null)
                        .set(TurnEntity::getProvider, provider)
                        .set(TurnEntity::getModel, model)
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
    public int updateStaleTurnPending(LocalDateTime staleBefore) {
        LambdaUpdateWrapper<TurnEntity> update = clearResult(
                Wrappers.<TurnEntity>lambdaUpdate()
                        .eq(TurnEntity::getStatus, TurnStatusEnum.RUNNING)
                        .isNotNull(TurnEntity::getStartedAt)
                        .lt(TurnEntity::getStartedAt, staleBefore)
                        .set(TurnEntity::getStatus, TurnStatusEnum.PENDING)
                        .set(TurnEntity::getProvider, null)
                        .set(TurnEntity::getModel, null)
                        .set(TurnEntity::getStartedAt, null));
        return executeUpdate(update);
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

    private LambdaUpdateWrapper<TurnEntity> clearResult(LambdaUpdateWrapper<TurnEntity> update) {
        return update
                .set(TurnEntity::getErrorMessage, null)
                .set(TurnEntity::getInputTokens, null)
                .set(TurnEntity::getOutputTokens, null)
                .set(TurnEntity::getTotalTokens, null)
                .set(TurnEntity::getProviderRequestId, null)
                .set(TurnEntity::getFinishReason, null)
                .set(TurnEntity::getFinishedAt, null);
    }

    private int executeUpdate(LambdaUpdateWrapper<TurnEntity> update) {
        return turnMapper.update(new TurnEntity(), update);
    }
}
