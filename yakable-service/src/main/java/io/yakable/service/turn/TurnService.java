package io.yakable.service.turn;

import io.yakable.common.bean.vo.session.TokenUsageVO;
import io.yakable.common.bean.vo.session.TurnExecutionVO;
import io.yakable.common.bean.vo.session.TurnInvocationVO;
import io.yakable.common.bean.vo.session.TurnVO;
import io.yakable.common.enums.session.TurnStatusEnum;
import io.yakable.common.utils.ConverUtils;
import io.yakable.dao.entity.TurnEntity;
import io.yakable.dao.repository.TurnRepository;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Turn 业务服务。
 */
@Service
public class TurnService {

    @Resource
    private TurnRepository turnRepository;

    /**
     * 新增待执行 Turn。
     */
    public TurnVO addTurn(String sessionId) {
        TurnEntity entity = new TurnEntity();
        entity.initCreate();
        entity.setSessionId(sessionId);
        entity.setStatus(TurnStatusEnum.PENDING);
        entity.setAttemptCount(0);
        turnRepository.add(entity);
        return toTurnVO(entity);
    }

    /**
     * 根据 ID 查询 Turn。
     */
    public Optional<TurnVO> queryTurn(String turnId) {
        return turnRepository.queryById(turnId).map(TurnService::toTurnVO);
    }

    /**
     * 查询 Turn 执行上下文。
     */
    public Optional<TurnExecutionVO> queryTurnExecution(String turnId) {
        return turnRepository.queryById(turnId).map(entity -> ConverUtils.convert(entity, TurnExecutionVO.class));
    }

    /**
     * 查询 Session 当前活跃 Turn 数量。
     */
    public long queryActiveTurnCount(String sessionId) {
        return turnRepository.queryActiveTurnCount(sessionId);
    }

    /**
     * 查询 Session 下的 Turn。
     */
    public List<TurnVO> queryTurnList(String sessionId) {
        return turnRepository.queryTurnList(sessionId).stream().map(TurnService::toTurnVO).toList();
    }

    /**
     * 查询 Session 最新 Turn。
     */
    public Optional<TurnVO> queryLatestTurn(String sessionId) {
        return turnRepository.queryLatestTurn(sessionId).map(TurnService::toTurnVO);
    }

    /**
     * 将待执行 Turn 更新为运行中状态。
     */
    public Optional<TurnVO> updatePendingTurn(String turnId, LocalDateTime claimedAt, String provider, String model) {
        return turnRepository.updatePendingTurn(turnId, claimedAt, provider, model).map(TurnService::toTurnVO);
    }

    /**
     * 将运行中 Turn 更新为成功状态。
     */
    public int updateTurnSucceeded(
            String turnId, String sessionId, String provider, String model,
            Long inputTokens, Long outputTokens, Long totalTokens,
            String providerRequestId, String finishReason, LocalDateTime completedAt) {
        return turnRepository.updateTurnSucceeded(
                turnId, sessionId, provider, model,
                inputTokens, outputTokens, totalTokens,
                providerRequestId, finishReason, completedAt);
    }

    /**
     * 将运行中 Turn 更新为失败状态。
     */
    public int updateTurnFailed(String turnId, String sessionId, String errorMessage, LocalDateTime failedAt) {
        return turnRepository.updateTurnFailed(turnId, sessionId, errorMessage, failedAt);
    }

    /**
     * 将超时运行中的 Turn 恢复为待执行状态。
     */
    public int updateStaleTurnPending(LocalDateTime staleBefore) {
        return turnRepository.updateStaleTurnPending(staleBefore);
    }

    /**
     * 查询待执行 Turn ID。
     */
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
        if (entity.getProvider() == null && entity.getModel() == null) {
            return null;
        }

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
