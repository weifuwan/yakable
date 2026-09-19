package io.yakable.infrastructure.persistence.memory.session;

import io.yakable.domain.session.Session;
import io.yakable.domain.session.repository.SessionRepository;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

public final class InMemorySessionRepository
        implements SessionRepository {

    private final ConcurrentMap<String, Session> sessions =
            new ConcurrentHashMap<>();

    @Override
    public Session save(Session session) {
        sessions.put(session.id(), session);
        return session;
    }

    @Override
    public Optional<Session> findById(String sessionId) {
        return Optional.ofNullable(sessions.get(sessionId));
    }

    @Override
    public List<Session> findByProjectId(String projectId) {
        return sessions.values().stream()
                .filter(session -> session.projectId().equals(projectId))
                .toList();
    }
}
