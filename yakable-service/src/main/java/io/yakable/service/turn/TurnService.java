package io.yakable.service.turn;

import io.yakable.common.bean.vo.session.TurnExecutionVO;
import io.yakable.common.bean.vo.session.TurnVO;
import io.yakable.common.enums.session.TurnTypeEnum;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Turn 业务服务。
 */
public interface TurnService {

    /**
     * 新增待执行 Turn，并确定本轮模型。
     */
    TurnVO addTurn(String sessionId, TurnTypeEnum turnType, String provider, String model, String requestId);

    /**
     * 按 Session 和客户端请求ID查询 Turn。
     */
    Optional<TurnVO> queryTurnByRequestId(String sessionId, String requestId);

    /**
     * 根据 ID 查询 Turn。
     */
    Optional<TurnVO> queryTurn(String turnId);

    /**
     * 查询 Turn 执行上下文。
     */
    Optional<TurnExecutionVO> queryTurnExecution(String turnId);

    /**
     * 查询 Session 当前活跃 Turn 数量。
     */
    long queryActiveTurnCount(String sessionId);

    /**
     * 查询 Session 下的 Turn。
     */
    List<TurnVO> queryTurnList(String sessionId);

    /**
     * 按 ID 批量查询 Turn。
     */
    List<TurnVO> queryTurnListByIds(List<String> turnIds);

    /**
     * 查询 Session 最新 Turn。
     */
    Optional<TurnVO> queryLatestTurn(String sessionId);

    /**
     * 将待执行 Turn 更新为运行中状态。
     */
    Optional<TurnVO> updatePendingTurn(String turnId, LocalDateTime claimedAt);

    /**
     * 将运行中 Turn 更新为成功状态。
     */
    int updateTurnSucceeded(
            String turnId, String sessionId,
            Long inputTokens, Long outputTokens, Long totalTokens,
            String providerRequestId, String finishReason, LocalDateTime completedAt);

    /**
     * 将运行中 Turn 更新为失败状态。
     */
    int updateTurnFailed(String turnId, String sessionId, String errorMessage, LocalDateTime failedAt);

    /**
     * 将待执行或运行中的 Turn 更新为停止状态。
     */
    int updateTurnStopped(String turnId, String sessionId, LocalDateTime stoppedAt);

    /**
     * 将指定运行中的 Turn 恢复为待执行状态。
     */
    int updateRunningTurnPending(String turnId);

    /**
     * 将超时运行中的 Turn 恢复为待执行状态。
     */
    int updateStaleTurnPending(LocalDateTime staleBefore);

    /**
     * 查询待执行 Turn ID。
     */
    List<String> queryPendingTurnIdList(int limit);
}
