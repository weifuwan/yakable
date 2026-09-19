package io.yakable.boot.session;

import io.yakable.core.session.SessionMessage;
import io.yakable.core.session.SessionMessageRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

final class InMemorySessionMessageRepository
        implements SessionMessageRepository {

    private final ConcurrentMap<String, CopyOnWriteArrayList<SessionMessage>>
            messagesBySession = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, AtomicLong> sequencesBySession =
            new ConcurrentHashMap<>();

    @Override
    public SessionMessage save(SessionMessage message) {
        messagesBySession
                .computeIfAbsent(
                        message.sessionId(),
                        ignored -> new CopyOnWriteArrayList<>()
                )
                .add(message);
        return message;
    }

    @Override
    public List<SessionMessage> findBySessionId(String sessionId) {
        return new ArrayList<>(messagesBySession.getOrDefault(
                sessionId,
                new CopyOnWriteArrayList<>()
        ));
    }

    @Override
    public long nextSequence(String sessionId) {
        return sequencesBySession
                .computeIfAbsent(sessionId, ignored -> new AtomicLong())
                .incrementAndGet();
    }
}
