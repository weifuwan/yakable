package io.yakable.application.session;

import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionInactiveException;
import io.yakable.domain.session.SessionNotFoundException;
import io.yakable.domain.session.SessionStatus;
import io.yakable.domain.session.Turn;
import io.yakable.domain.session.TurnStartResult;
import io.yakable.domain.session.TurnStatus;
import io.yakable.domain.session.repository.SessionExecutionRepository;
import io.yakable.domain.session.repository.SessionRepository;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public final class SessionCommandService {

    private final SessionRepository sessionRepository;
    private final SessionExecutionRepository executionRepository;

    public SessionCommandService(
            SessionRepository sessionRepository,
            SessionExecutionRepository executionRepository
    ) {
        this.sessionRepository = Objects.requireNonNull(
                sessionRepository,
                "sessionRepository"
        );
        this.executionRepository = Objects.requireNonNull(
                executionRepository,
                "executionRepository"
        );
    }

    public Session createSession(
            String projectId,
            String title,
            String provider,
            String model
    ) {
        Instant now = Instant.now();
        Session session = new Session(
                UUID.randomUUID().toString(),
                projectId,
                title,
                provider,
                model,
                SessionStatus.ACTIVE,
                now,
                now
        );
        return sessionRepository.save(session);
    }

    public TurnStartResult startTurn(
            String projectId,
            String sessionId,
            String content
    ) {
        String normalizedContent = requireText(content, "content");
        Session session = requireOwnedSession(projectId, sessionId);
        if (session.status() != SessionStatus.ACTIVE) {
            throw new SessionInactiveException(sessionId);
        }

        Instant now = Instant.now();
        Turn pendingTurn = new Turn(
                UUID.randomUUID().toString(),
                sessionId,
                TurnStatus.PENDING,
                0,
                null,
                null,
                null,
                now,
                now
        );

        TurnStartResult result = executionRepository.createPendingTurn(
                pendingTurn,
                UUID.randomUUID().toString(),
                normalizedContent,
                now
        );

        sessionRepository.save(session.touch(now));
        return result;
    }

    private Session requireOwnedSession(
            String projectId,
            String sessionId
    ) {
        String normalizedProjectId = requireText(projectId, "projectId");
        String normalizedSessionId = requireText(sessionId, "sessionId");

        Session session = sessionRepository.findById(normalizedSessionId)
                .orElseThrow(() -> new SessionNotFoundException(
                        normalizedSessionId
                ));

        if (!session.projectId().equals(normalizedProjectId)) {
            throw new SessionNotFoundException(normalizedSessionId);
        }

        return session;
    }

    private static String requireText(String value, String field) {
        Objects.requireNonNull(value, field);
        String normalized = value.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(
                    field + " must not be blank"
            );
        }
        return normalized;
    }
}
