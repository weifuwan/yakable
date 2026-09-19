package io.yakable.dao.session;

import io.yakable.dao.session.model.SessionPO;

import java.util.Optional;

public interface SessionDao {

    SessionPO save(SessionPO session);

    Optional<SessionPO> findById(String sessionId);

    Optional<SessionPO> lockById(String sessionId);
}
