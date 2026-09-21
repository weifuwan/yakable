package io.yakable.dao.repository.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.yakable.dao.entity.SessionEntity;
import io.yakable.dao.mapper.SessionMapper;
import io.yakable.dao.repository.SessionRepository;
import jakarta.annotation.Resource;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.util.List;
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
    public Optional<SessionEntity> querySession(String projectId, String sessionId, String userId) {
        return Optional.ofNullable(sessionMapper.selectOne(
                Wrappers.<SessionEntity>lambdaQuery()
                        .eq(SessionEntity::getId, sessionId)
                        .eq(SessionEntity::getProjectId, projectId)
                        .eq(SessionEntity::getCreateBy, userId)));
    }

    @Override
    public Optional<SessionEntity> queryLatestSession(String projectId) {
        Page<SessionEntity> page = new Page<>(1, 1, false);
        return sessionMapper.selectPage(
                        page,
                        Wrappers.<SessionEntity>lambdaQuery()
                                .eq(SessionEntity::getProjectId, projectId)
                                .orderByDesc(SessionEntity::getUpdateTime, SessionEntity::getId))
                .getRecords()
                .stream()
                .findFirst();
    }

    @Override
    public List<SessionEntity> queryLatestSessionList(List<String> projectIds) {
        return projectIds == null || projectIds.isEmpty() ? List.of() : sessionMapper.selectLatestByProjectIds(projectIds);
    }

    @Override
    public boolean querySessionForUpdate(String sessionId) {
        return sessionMapper.selectOne(
                Wrappers.<SessionEntity>lambdaQuery()
                        .eq(SessionEntity::getId, sessionId)
                        .last("FOR UPDATE")) != null;
    }
}
