package io.yakable.application.session;

import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.SessionNotFoundException;
import io.yakable.domain.session.Turn;
import io.yakable.domain.session.repository.SessionExecutionRepository;
import io.yakable.domain.session.repository.SessionRepository;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;

public final class SessionQueryService {

    private final SessionRepository sessionRepository;
    private final SessionExecutionRepository executionRepository;

    public SessionQueryService(
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

    public SessionSnapshot getSnapshot(
            String projectId,
            String sessionId
    ) {
        Session session = requireOwnedSession(
                projectId,
                sessionId
        );

        List<Turn> turns = executionRepository
                .findTurnsBySessionId(session.id())
                .stream()
                .sorted(Comparator.comparing(Turn::createdAt))
                .toList();

        List<SessionMessage> messages = executionRepository
                .findMessagesBySessionId(session.id())
                .stream()
                .sorted(Comparator.comparingLong(SessionMessage::sequence))
                .toList();

        return new SessionSnapshot(session, turns, messages);
    }

    public List<Session> listProjectSessions(String projectId) {
        String normalizedProjectId =
                requireText(projectId, "projectId");

        return sessionRepository
                .findByProjectId(normalizedProjectId)
                .stream()
                .sorted(
                        Comparator.comparing(
                                Session::updatedAt
                        ).reversed()
                )
                .toList();
    }

    private Session requireOwnedSession(
            String projectId,
            String sessionId
    ) {
        String normalizedProjectId =
                requireText(projectId, "projectId");
        String normalizedSessionId =
                requireText(sessionId, "sessionId");

        Session session = sessionRepository
                .findById(normalizedSessionId)
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
