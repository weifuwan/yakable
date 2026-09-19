package io.yakable.dao.session;

import io.yakable.dao.session.model.SessionPO;
import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionStatus;
import io.yakable.domain.session.repository.SessionRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;
import java.util.Optional;

@Repository
public class SessionRepositoryAdapter
        implements SessionRepository {

    private final SessionDao dao;

    public SessionRepositoryAdapter(SessionDao dao) {
        this.dao = Objects.requireNonNull(dao, "dao");
    }

    @Override
    @Transactional
    public Session save(Session session) {
        dao.save(toPO(session));
        return session;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Session> findById(String sessionId) {
        return dao.findById(sessionId).map(
                SessionRepositoryAdapter::toDomain
        );
    }

    private static SessionPO toPO(Session session) {
        SessionPO po = new SessionPO();
        po.setId(session.id());
        po.setProjectId(session.projectId());
        po.setTitle(session.title());
        po.setProvider(session.provider());
        po.setModel(session.model());
        po.setStatus(session.status().name());
        po.setCreatedAt(session.createdAt());
        po.setUpdatedAt(session.updatedAt());
        return po;
    }

    private static Session toDomain(SessionPO po) {
        return new Session(
                po.getId(),
                po.getProjectId(),
                po.getTitle(),
                po.getProvider(),
                po.getModel(),
                SessionStatus.valueOf(po.getStatus()),
                po.getCreatedAt(),
                po.getUpdatedAt()
        );
    }
}
