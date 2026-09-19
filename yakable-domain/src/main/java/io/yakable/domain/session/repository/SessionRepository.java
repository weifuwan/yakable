package io.yakable.domain.session.repository;

import io.yakable.domain.session.Session;

import java.util.List;
import java.util.Optional;

public interface SessionRepository {

    Session save(Session session);

    Optional<Session> findById(String sessionId);

    List<Session> findByProjectId(String projectId);
}
