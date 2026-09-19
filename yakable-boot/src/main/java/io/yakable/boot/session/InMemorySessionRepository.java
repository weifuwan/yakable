package io.yakable.boot.session;

import io.yakable.core.session.Session;
import io.yakable.core.session.SessionRepository;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

final class InMemorySessionRepository implements SessionRepository {

    private final ConcurrentMap<String, Session> sessions = new ConcurrentHashMap<>();

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
