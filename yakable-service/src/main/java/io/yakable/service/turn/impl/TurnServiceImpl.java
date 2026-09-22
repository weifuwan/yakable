package io.yakable.service.turn.impl;

import io.yakable.common.bean.vo.session.TokenUsageVO;
import io.yakable.common.bean.vo.session.TurnExecutionVO;
import io.yakable.common.bean.vo.session.TurnInvocationVO;
import io.yakable.common.bean.vo.session.TurnVO;
import io.yakable.common.enums.session.TurnStatusEnum;
import io.yakable.common.utils.ConverUtils;
import io.yakable.dao.entity.TurnEntity;
import io.yakable.dao.repository.TurnRepository;
import io.yakable.service.turn.TurnService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class TurnServiceImpl implements TurnService {

    @Resource
    private TurnRepository turnRepository;

    @Override
    public TurnVO addTurn(String sessionId, String provider, String model, String requestId) {
        TurnEntity entity = new TurnEntity();
        entity.initCreate();
        entity.setSessionId(sessionId);
        entity.setRequestId(requestId);
        entity.setProvider(provider);
        entity.setModel(model);
        entity.setStatus(TurnStatusEnum.PENDING);
        entity.setAttemptCount(0);
        turnRepository.add(entity);
        return toTurnVO(entity);
    }

    @Override
    public Optional<TurnVO> queryTurnByRequestId(String sessionId, String requestId) {
        return turnRepository.queryByRequestId(sessionId, requestId).map(TurnServiceImpl::toTurnVO);
    }

    @Override
    public Optional<TurnVO> queryTurn(String turnId) {
        return turnRepository.queryById(turnId).map(TurnServiceImpl::toTurnVO);
    }

    @Override
    public Optional<TurnExecutionVO> queryTurnExecution(String turnId) {
        return turnRepository.queryById(turnId)
                .map(entity -> ConverUtils.convert(entity, TurnExecutionVO.class));
    }

    @Override
    public long queryActiveTurnCount(String sessionId) {
        return turnRepository.queryActiveTurnCount(sessionId);
    }

    @Override
    public List<TurnVO> queryTurnList(String sessionId) {
        return turnRepository.queryTurnList(sessionId).stream().map(TurnServiceImpl::toTurnVO).toList();
    }

    @Override
    public List<TurnVO> queryTurnListByIds(List<String> turnIds) {
        return turnRepository.queryTurnListByIds(turnIds).stream().map(TurnServiceImpl::toTurnVO).toList();
    }

    @Override
    public Optional<TurnVO> queryLatestTurn(String sessionId) {
        return turnRepository.queryLatestTurn(sessionId).map(TurnServiceImpl::toTurnVO);
    }

    @Override
    public Optional<TurnVO> updatePendingTurn(String turnId, LocalDateTime claimedAt) {
        return turnRepository.updatePendingTurn(turnId, claimedAt).map(TurnServiceImpl::toTurnVO);
    }

    @Override
    public int updateTurnSucceeded(
            String turnId, String sessionId,
            Long inputTokens, Long outputTokens, Long totalTokens,
            String providerRequestId, String finishReason, LocalDateTime completedAt) {
        return turnRepository.updateTurnSucceeded(
                turnId, sessionId,
                inputTokens, outputTokens, totalTokens,
                providerRequestId, finishReason, completedAt);
    }

    @Override
    public int updateTurnFailed(String turnId, String sessionId, String errorMessage, LocalDateTime failedAt) {
        return turnRepository.updateTurnFailed(turnId, sessionId, errorMessage, failedAt);
    }

    @Override
    public int updateTurnStopped(String turnId, String sessionId, LocalDateTime stoppedAt) {
        return turnRepository.updateTurnStopped(turnId, sessionId, stoppedAt);
    }

    @Override
    public int updateRunningTurnPending(String turnId) {
        return turnRepository.updateRunningTurnPending(turnId);
    }

    @Override
    public int updateStaleTurnPending(LocalDateTime staleBefore) {
        return turnRepository.updateStaleTurnPending(staleBefore);
    }

    @Override
    public List<String> queryPendingTurnIdList(int limit) {
        return turnRepository.queryPendingTurnIdList(limit);
    }

    private static TurnVO toTurnVO(TurnEntity entity) {
        TurnVO result = ConverUtils.convert(entity, TurnVO.class);
        result.setStatus(entity.getStatus().name());
        result.setAttemptCount(entity.getAttemptCount() == null ? 0 : entity.getAttemptCount());
        result.setInvocation(toInvocationVO(entity));
        result.setDurationMs(durationMillis(entity));
        result.setCreatedAt(entity.getCreateTime());
        result.setUpdatedAt(entity.getUpdateTime());
        return result;
    }

    private static TurnInvocationVO toInvocationVO(TurnEntity entity) {
        TurnInvocationVO result = ConverUtils.convert(entity, TurnInvocationVO.class);
        if (entity.getInputTokens() != null || entity.getOutputTokens() != null || entity.getTotalTokens() != null) {
            result.setUsage(ConverUtils.convert(entity, TokenUsageVO.class));
        }
        return result;
    }

    private static Long durationMillis(TurnEntity entity) {
        if (entity.getStartedAt() == null || entity.getFinishedAt() == null) {
            return null;
        }
        return Duration.between(entity.getStartedAt(), entity.getFinishedAt()).toMillis();
    }
}
