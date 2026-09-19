package io.yakable.boot.session;

import io.yakable.core.session.SessionBusyException;
import io.yakable.core.session.SessionExecutionRepository;
import io.yakable.core.session.SessionMessage;
import io.yakable.core.session.Turn;
import io.yakable.core.session.TurnStartResult;
import io.yakable.core.session.TurnStatus;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

final class InMemorySessionExecutionRepository
        implements SessionExecutionRepository {

    private final ConcurrentMap<String, Turn> turns =
            new ConcurrentHashMap<>();
    private final ConcurrentMap<String, CopyOnWriteArrayList<SessionMessage>>
            messagesBySession = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, AtomicLong> sequencesBySession =
            new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Object> sessionLocks =
            new ConcurrentHashMap<>();

    @Override
    public TurnStartResult createPendingTurn(
            Turn turn,
            String userMessageId,
            String content,
            Instant createdAt
    ) {
        Object lock = lockFor(turn.sessionId());

        synchronized (lock) {
            boolean hasActiveTurn = turns.values().stream()
                    .anyMatch(existing ->
                            existing.sessionId().equals(turn.sessionId())
                                    && existing.status().active()
                    );

            if (hasActiveTurn) {
                throw new SessionBusyException(turn.sessionId());
            }

            SessionMessage userMessage = newMessage(
                    userMessageId,
                    turn.sessionId(),
                    turn.id(),
                    SessionMessage.Role.USER,
                    content,
                    createdAt
            );

            turns.put(turn.id(), turn);
            messages(turn.sessionId()).add(userMessage);

            return new TurnStartResult(turn, userMessage);
        }
    }

    @Override
    public Optional<Turn> claimPendingTurn(
            String turnId,
            Instant claimedAt
    ) {
        Turn snapshot = turns.get(turnId);
        if (snapshot == null) {
            return Optional.empty();
        }

        Object lock = lockFor(snapshot.sessionId());
        synchronized (lock) {
            Turn current = turns.get(turnId);
            if (current == null || current.status() != TurnStatus.PENDING) {
                return Optional.empty();
            }

            Turn running = current.markRunning(claimedAt);
            turns.put(turnId, running);
            return Optional.of(running);
        }
    }

    @Override
    public Turn completeTurn(
            Turn runningTurn,
            String assistantMessageId,
            String content,
            Instant completedAt
    ) {
        Object lock = lockFor(runningTurn.sessionId());
        synchronized (lock) {
            Turn current = requireCurrentRunningTurn(runningTurn);

            SessionMessage assistantMessage = newMessage(
                    assistantMessageId,
                    current.sessionId(),
                    current.id(),
                    SessionMessage.Role.ASSISTANT,
                    content,
                    completedAt
            );
            Turn succeeded = current.markSucceeded(completedAt);

            messages(current.sessionId()).add(assistantMessage);
            turns.put(current.id(), succeeded);
            return succeeded;
        }
    }

    @Override
    public Turn failTurn(
            Turn runningTurn,
            String errorMessage,
            Instant failedAt
    ) {
        Object lock = lockFor(runningTurn.sessionId());
        synchronized (lock) {
            Turn current = requireCurrentRunningTurn(runningTurn);
            Turn failed = current.markFailed(
                    errorMessage,
                    failedAt
            );
            turns.put(current.id(), failed);
            return failed;
        }
    }

    @Override
    public Optional<Turn> findTurnById(String turnId) {
        return Optional.ofNullable(turns.get(turnId));
    }

    @Override
    public List<Turn> findTurnsBySessionId(String sessionId) {
        return turns.values().stream()
                .filter(turn -> turn.sessionId().equals(sessionId))
                .toList();
    }

    @Override
    public List<SessionMessage> findMessagesBySessionId(
            String sessionId
    ) {
        return new ArrayList<>(
                messagesBySession.getOrDefault(
                        sessionId,
                        new CopyOnWriteArrayList<>()
                )
        );
    }

    private Turn requireCurrentRunningTurn(Turn expected) {
        Turn current = turns.get(expected.id());
        if (current == null
                || !current.sessionId().equals(expected.sessionId())
                || current.status() != TurnStatus.RUNNING) {
            throw new IllegalStateException(
                    "Turn is no longer RUNNING: " + expected.id()
            );
        }
        return current;
    }

    private SessionMessage newMessage(
            String messageId,
            String sessionId,
            String turnId,
            SessionMessage.Role role,
            String content,
            Instant createdAt
    ) {
        long sequence = sequencesBySession
                .computeIfAbsent(
                        sessionId,
                        ignored -> new AtomicLong()
                )
                .incrementAndGet();

        return new SessionMessage(
                messageId,
                sessionId,
                turnId,
                role,
                content,
                sequence,
                createdAt
        );
    }

    private CopyOnWriteArrayList<SessionMessage> messages(
            String sessionId
    ) {
        return messagesBySession.computeIfAbsent(
                sessionId,
                ignored -> new CopyOnWriteArrayList<>()
        );
    }

    private Object lockFor(String sessionId) {
        return sessionLocks.computeIfAbsent(
                sessionId,
                ignored -> new Object()
        );
    }
}
