package io.yakable.core.session;

import java.util.List;

public interface SessionMessageRepository {

    SessionMessage save(SessionMessage message);

    List<SessionMessage> findBySessionId(String sessionId);

    long nextSequence(String sessionId);
}
