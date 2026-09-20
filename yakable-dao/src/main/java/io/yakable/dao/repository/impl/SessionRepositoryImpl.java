package io.yakable.dao.repository.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import io.yakable.dao.entity.SessionEntity;
import io.yakable.dao.mapper.SessionMapper;
import io.yakable.dao.repository.SessionRepository;
import jakarta.annotation.Resource;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
@DependsOn("yakableFlyway")
public class SessionRepositoryImpl extends BaseRepositoryImpl<SessionMapper, SessionEntity> implements SessionRepository {

    @Resource
    private SessionMapper sessionMapper;

    @Override
    protected SessionMapper mapper() {
        return sessionMapper;
    }

    @Override
    public Optional<SessionEntity> querySession(String projectId, String sessionId) {
        return Optional.ofNullable(sessionMapper.selectOne(
                Wrappers.<SessionEntity>lambdaQuery()
                        .eq(SessionEntity::getId, sessionId)
                        .eq(SessionEntity::getProjectId, projectId)));
    }

    @Override
    public boolean querySessionForUpdate(String sessionId) {
        return sessionMapper.selectOne(
                Wrappers.<SessionEntity>lambdaQuery()
                        .eq(SessionEntity::getId, sessionId)
                        .last("FOR UPDATE")) != null;
    }
}
