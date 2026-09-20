package io.yakable.dao.repository;

import io.yakable.dao.entity.MessageEntity;
import io.yakable.dao.entity.SessionEntity;
import io.yakable.dao.entity.TurnEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Session 领域数据访问入口。
 */
public interface SessionRepository extends BaseRepository<SessionEntity> {

    /**
     * 查询指定 Project 下的 Session。
     */
    Optional<SessionEntity> querySession(String projectId, String sessionId);

    /**
     * 查询并锁定 Session。
     */
    boolean querySessionForUpdate(String sessionId);

    /**
     * 查询 Session 当前活跃 Turn 数量。
     */
    long queryActiveTurnCount(String sessionId);

    /**
     * 新增 Turn。
     */
    int addTurn(TurnEntity entity);

    /**
     * 新增 Message。
     */
    int addMessage(MessageEntity entity);

    /**
     * 查询下一条 Message 序号。
     */
    long queryNextMessageSequence(String sessionId);

    /**
     * 查询最新 Message 序号。
     */
    long queryLatestMessageSequence(String sessionId);

    /**
     * 根据 ID 查询 Turn。
     */
    Optional<TurnEntity> queryTurn(String turnId);

    /**
     * 查询 Session 下的 Turn 列表。
     */
    List<TurnEntity> queryTurnList(String sessionId);

    /**
     * 查询 Session 最新 Turn。
     */
    Optional<TurnEntity> queryLatestTurn(String sessionId);

    /**
     * 查询 Session 下的 Message 列表。
     */
    List<MessageEntity> queryMessageList(String sessionId);

    /**
     * 查询指定序号之后的 Message。
     */
    List<MessageEntity> queryMessageAfter(String sessionId, long afterSequence);

    /**
     * 查询指定序号之前的 Message。
     */
    List<MessageEntity> queryMessageBefore(String sessionId, Long beforeSequence, int limit);

    /**
     * 将待执行 Turn 更新为运行中状态。
     */
    Optional<TurnEntity> updatePendingTurn(String turnId, LocalDateTime claimedAt, String provider, String model);

    /**
     * 将运行中 Turn 更新为成功状态。
     */
    int updateTurnSucceeded(
            String turnId, String sessionId, String provider, String model,
            Long inputTokens, Long outputTokens, Long totalTokens,
            String providerRequestId, String finishReason, LocalDateTime completedAt);

    /**
     * 将运行中 Turn 更新为失败状态。
     */
    int updateTurnFailed(String turnId, String sessionId, String errorMessage, LocalDateTime failedAt);

    /**
     * 将超时运行中的 Turn 恢复为待执行状态。
     */
    int updateStaleTurnPending(LocalDateTime staleBefore, LocalDateTime recoveredAt);

    /**
     * 查询待执行 Turn ID 列表。
     */
    List<String> queryPendingTurnIdList(int limit);
}
