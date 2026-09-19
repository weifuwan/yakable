package io.yakable.dao.repository.impl;

import io.yakable.dao.entity.SessionEntity;
import io.yakable.dao.mapper.SessionMapper;
import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionStatus;
import io.yakable.domain.session.repository.SessionRepository;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;
import java.util.Optional;

@Repository
@DependsOn("yakableFlyway")
public class SessionRepositoryImpl implements SessionRepository {

    private final SessionMapper mapper;

    public SessionRepositoryImpl(SessionMapper mapper) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @Override
    @Transactional
    public Session save(Session session) {
        SessionEntity entity = toEntity(session);
        if (mapper.selectById(entity.getId()) == null) {
            mapper.insert(entity);
        } else {
            mapper.updateById(entity);
        }
        return session;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Session> findById(String sessionId) {
        return Optional.ofNullable(mapper.selectById(sessionId))
                .map(SessionRepositoryImpl::toDomain);
    }

    private static SessionEntity toEntity(Session session) {
        SessionEntity entity = new SessionEntity();
        entity.setId(session.id());
        entity.setProjectId(session.projectId());
        entity.setTitle(session.title());
        entity.setProvider(session.provider());
        entity.setModel(session.model());
        entity.setStatus(session.status().name());
        entity.setCreatedAt(session.createdAt());
        entity.setUpdatedAt(session.updatedAt());
        return entity;
    }

    private static Session toDomain(SessionEntity entity) {
        return new Session(
                entity.getId(),
                entity.getProjectId(),
                entity.getTitle(),
                entity.getProvider(),
                entity.getModel(),
                SessionStatus.valueOf(entity.getStatus()),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
