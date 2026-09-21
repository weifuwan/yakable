package io.yakable.dao.repository.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import io.yakable.dao.entity.AuthSessionEntity;
import io.yakable.dao.mapper.AuthSessionMapper;
import io.yakable.dao.repository.AuthSessionRepository;
import jakarta.annotation.Resource;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
@DependsOn("yakableFlyway")
public class AuthSessionRepositoryImpl extends BaseRepositoryImpl<AuthSessionMapper, AuthSessionEntity> implements AuthSessionRepository {

    @Resource
    private AuthSessionMapper authSessionMapper;

    @Override
    protected AuthSessionMapper mapper() {
        return authSessionMapper;
    }

    @Override
    public AuthSessionEntity queryAuthSessionByTokenHash(String tokenHash, LocalDateTime now) {
        return authSessionMapper.selectOne(Wrappers.<AuthSessionEntity>lambdaQuery()
                .eq(AuthSessionEntity::getTokenHash, tokenHash)
                .isNull(AuthSessionEntity::getRevokedAt)
                .gt(AuthSessionEntity::getExpiresAt, now));
    }

    @Override
    public int updateRevokeAuthSessionByTokenHash(String tokenHash, LocalDateTime revokedAt, String updateBy) {
        return authSessionMapper.update(null, Wrappers.<AuthSessionEntity>lambdaUpdate()
                .eq(AuthSessionEntity::getTokenHash, tokenHash)
                .isNull(AuthSessionEntity::getRevokedAt)
                .set(AuthSessionEntity::getRevokedAt, revokedAt)
                .set(AuthSessionEntity::getUpdateTime, revokedAt)
                .set(AuthSessionEntity::getUpdateBy, updateBy));
    }

    @Override
    public int updateRevokeAuthSessionByUserId(String userId, LocalDateTime revokedAt, String updateBy) {
        return authSessionMapper.update(null, Wrappers.<AuthSessionEntity>lambdaUpdate()
                .eq(AuthSessionEntity::getUserId, userId)
                .isNull(AuthSessionEntity::getRevokedAt)
                .set(AuthSessionEntity::getRevokedAt, revokedAt)
                .set(AuthSessionEntity::getUpdateTime, revokedAt)
                .set(AuthSessionEntity::getUpdateBy, updateBy));
    }
}
