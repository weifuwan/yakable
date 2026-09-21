package io.yakable.dao.repository;

import io.yakable.dao.entity.AuthSessionEntity;

import java.time.LocalDateTime;

/**
 * AuthSession 数据访问入口。
 */
public interface AuthSessionRepository extends BaseRepository<AuthSessionEntity> {

    /**
     * 按 Token Hash 查询有效 Session。
     */
    AuthSessionEntity queryAuthSessionByTokenHash(String tokenHash, LocalDateTime now);

    /**
     * 按 Token Hash 撤销 Session。
     */
    int updateRevokeAuthSessionByTokenHash(String tokenHash, LocalDateTime revokedAt, String updateBy);

    /**
     * 撤销用户全部 Session。
     */
    int updateRevokeAuthSessionByUserId(String userId, LocalDateTime revokedAt, String updateBy);
}
