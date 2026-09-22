package io.yakable.dao.repository;

import io.yakable.dao.entity.TurnEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Turn 数据访问入口。
 */
public interface TurnRepository extends BaseRepository<TurnEntity> {

    /**
     * 按 Session 和客户端请求ID查询 Turn。
     */
    Optional<TurnEntity> queryByRequestId(String sessionId, String requestId);

    /**
     * 查询 Session 当前活跃 Turn 数量。
     */
    long queryActiveTurnCount(String sessionId);

    /**
     * 查询 Session 下的 Turn 列表。
     */
    List<TurnEntity> queryTurnList(String sessionId);

    /**
     * 按 ID 批量查询 Turn。
     */
    List<TurnEntity> queryTurnListByIds(List<String> turnIds);

    /**
     * 查询 Session 最新 Turn。
     */
    Optional<TurnEntity> queryLatestTurn(String sessionId);

    /**
     * 将待执行 Turn 更新为运行中状态。
     */
    Optional<TurnEntity> updatePendingTurn(String turnId, LocalDateTime claimedAt);

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
     * 将超时运行中的 Turn 恢复为待执行状态。
     */
    int updateStaleTurnPending(LocalDateTime staleBefore);

    /**
     * 查询待执行 Turn ID 列表。
     */
    List<String> queryPendingTurnIdList(int limit);
}
