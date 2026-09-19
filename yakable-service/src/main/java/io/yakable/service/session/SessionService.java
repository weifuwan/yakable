package io.yakable.service.session;

import io.yakable.application.async.TurnDispatcher;
import io.yakable.application.session.SessionChanges;
import io.yakable.application.session.SessionMessagePage;
import io.yakable.application.session.SessionQueryRepository;
import io.yakable.application.session.SessionSnapshot;
import io.yakable.application.transaction.TransactionRunner;
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

public final class SessionService {

    private static final int MAX_MESSAGE_PAGE_SIZE = 100;

    private final SessionRepository sessionRepository;
    private final SessionExecutionRepository executionRepository;
    private final SessionQueryRepository queryRepository;
    private final TurnDispatcher turnDispatcher;
    private final TransactionRunner transactionRunner;

    public SessionService(
            SessionRepository sessionRepository,
            SessionExecutionRepository executionRepository,
            SessionQueryRepository queryRepository,
            TurnDispatcher turnDispatcher,
            TransactionRunner transactionRunner
    ) {
        this.sessionRepository = Objects.requireNonNull(
                sessionRepository,
                "sessionRepository"
        );
        this.executionRepository = Objects.requireNonNull(
                executionRepository,
                "executionRepository"
        );
        this.queryRepository = Objects.requireNonNull(
                queryRepository,
                "queryRepository"
        );
        this.turnDispatcher = Objects.requireNonNull(
                turnDispatcher,
                "turnDispatcher"
        );
        this.transactionRunner = Objects.requireNonNull(
                transactionRunner,
                "transactionRunner"
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
                requireText(projectId, "projectId"),
                requireText(title, "title"),
                requireText(provider, "provider"),
                requireText(model, "model"),
                SessionStatus.ACTIVE,
                now,
                now
        );
        return sessionRepository.save(session);
    }

    public TurnStartResult createPendingTurn(
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

    public TurnStartResult startTurn(
            String projectId,
            String sessionId,
            String content
    ) {
        TurnStartResult result = transactionRunner.required(
                () -> createPendingTurn(
                        projectId,
                        sessionId,
                        content
                )
        );

        dispatchBestEffort(result.turn().id());
        return result;
    }

    public SessionSnapshot getSnapshot(
            String projectId,
            String sessionId
    ) {
        String normalizedProjectId =
                requireText(projectId, "projectId");
        String normalizedSessionId =
                requireText(sessionId, "sessionId");

        return queryRepository.findSnapshot(
                        normalizedProjectId,
                        normalizedSessionId
                )
                .orElseThrow(() -> new SessionNotFoundException(
                        normalizedSessionId
                ));
    }

    public SessionChanges getChanges(
            String projectId,
            String sessionId,
            long afterSequence
    ) {
        if (afterSequence < 0) {
            throw new IllegalArgumentException(
                    "afterSequence must not be negative"
            );
        }

        String normalizedProjectId =
                requireText(projectId, "projectId");
        String normalizedSessionId =
                requireText(sessionId, "sessionId");

        return queryRepository.findChanges(
                        normalizedProjectId,
                        normalizedSessionId,
                        afterSequence
                )
                .orElseThrow(() -> new SessionNotFoundException(
                        normalizedSessionId
                ));
    }

    public SessionMessagePage getMessagePage(
            String projectId,
            String sessionId,
            Long beforeSequence,
            int limit
    ) {
        if (beforeSequence != null && beforeSequence <= 0) {
            throw new IllegalArgumentException(
                    "beforeSequence must be positive"
            );
        }
        if (limit <= 0 || limit > MAX_MESSAGE_PAGE_SIZE) {
            throw new IllegalArgumentException(
                    "limit must be between 1 and "
                            + MAX_MESSAGE_PAGE_SIZE
            );
        }

        String normalizedProjectId =
                requireText(projectId, "projectId");
        String normalizedSessionId =
                requireText(sessionId, "sessionId");

        return queryRepository.findMessagePage(
                        normalizedProjectId,
                        normalizedSessionId,
                        beforeSequence,
                        limit
                )
                .orElseThrow(() -> new SessionNotFoundException(
                        normalizedSessionId
                ));
    }

    private Session requireOwnedSession(
            String projectId,
            String sessionId
    ) {
        String normalizedProjectId =
                requireText(projectId, "projectId");
        String normalizedSessionId =
                requireText(sessionId, "sessionId");

        Session session = sessionRepository.findById(
                        normalizedSessionId
                )
                .orElseThrow(() -> new SessionNotFoundException(
                        normalizedSessionId
                ));

        if (!session.projectId().equals(normalizedProjectId)) {
            throw new SessionNotFoundException(
                    normalizedSessionId
            );
        }

        return session;
    }

    private void dispatchBestEffort(String turnId) {
        try {
            turnDispatcher.dispatch(turnId);
        } catch (RuntimeException ignored) {
            // PENDING is durable; recovery will retry dispatch.
        }
    }

    private static String requireText(
            String value,
            String field
    ) {
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
