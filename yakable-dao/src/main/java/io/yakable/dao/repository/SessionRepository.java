package io.yakable.dao.repository;

import io.yakable.dao.entity.SessionEntity;

import java.util.List;
import java.util.Optional;

/**
 * Session 数据访问入口。
 */
public interface SessionRepository extends BaseRepository<SessionEntity> {

    /**
     * 查询指定用户在 Project 下的 Session。
     */
    Optional<SessionEntity> querySession(String projectId, String sessionId, String userId);

    /**
     * 查询 Project 最新 Session。
     */
    Optional<SessionEntity> queryLatestSession(String projectId);

    /**
     * 批量查询 Project 最新 Session。
     */
    List<SessionEntity> queryLatestSessionList(List<String> projectIds);

    /**
     * 查询并锁定 Session。
     */
    boolean querySessionForUpdate(String sessionId);
}
